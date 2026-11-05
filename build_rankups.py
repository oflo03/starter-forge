"""Precompute fixed-type, unique stat-boost moves; the browser only reads the result."""
import csv, io, json, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent
BASE='https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
def read_csv(name):
    folder=ROOT/'references'/'pokeapi';folder.mkdir(parents=True,exist_ok=True)
    path=folder/name
    if not path.exists(): path.write_bytes(urllib.request.urlopen(BASE+name).read())
    return list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8'))))
names={int(r['move_id']):r['name'] for r in read_csv('move_names.csv') if r['local_language_id']=='3'}
moves={int(r['id']):r for r in read_csv('moves.csv')}
changes={}
for row in read_csv('move_meta_stat_changes.csv'):
    changes.setdefault(int(row['move_id']),{})[int(row['stat_id'])]=int(row['change'])
# Recent entries do not all have stat-change rows in the upstream CSV.
changes[837]={2:1,3:1,6:1} # Victory Dance
changes[868]={2:2,4:2,6:2} # Fillet Away
KEYS=['atk','def','spa','spd','spe'];LABELS=['공격','방어','특공','특방','스피드']
STAT_IDS=[2,3,4,5,6]
TYPE_IDS={1:'normal',2:'fighting',3:'flying',4:'poison',5:'ground',6:'rock',7:'bug',8:'ghost',9:'steel',10:'fire',11:'water',12:'grass',13:'electric',14:'psychic',15:'ice',16:'dragon',17:'dark',18:'fairy'}
forbidden=set()
for move_id,values in changes.items():
    move=moves.get(move_id,{})
    if move.get('damage_class_id')=='1' and move.get('target_id')=='7':
        positive=tuple(max(0,values.get(i,0)) for i in STAT_IDS)
        if any(positive): forbidden.add(positive)

original_identifiers=['swords-dance','nasty-plot','iron-defense','amnesia','agility','bulk-up','calm-mind','dragon-dance','quiver-dance','shift-gear','cosmic-power','work-up','victory-dance','cotton-guard','tail-glow','shell-smash']
by_identifier={v['identifier']:k for k,v in moves.items()}
def describe_boost(boosts):
    return ' / '.join(f'{LABELS[KEYS.index(key)]} +{value}' for key,value in boosts.items())
def base_entry(id,name,type_id,boosts,pp,source):
    return dict(id=id,templateId='rankup',name=name,type=type_id,category='변화',power=0,accuracy=None,pp=pp,priority=0,boosts=boosts,source=source,original=False,tags=['boost','fixed-type'],setsEnvironment=[],requiresEnvironment=[],penalties=[])
originals=[]
for identifier in original_identifiers:
    move_id=by_identifier[identifier];data=moves[move_id];stats=changes.get(move_id,{})
    boosts={key:stats[stat] for key,stat in zip(KEYS,STAT_IDS) if stats.get(stat,0)>0}
    assert boosts,identifier
    item=base_entry('original-boost-'+identifier,names[move_id],TYPE_IDS[int(data['type_id'])],boosts,int(data['pp']),'원작 기반')
    item['referenceName']=names[move_id];item['referenceId']=move_id
    for key,stat in zip(KEYS,STAT_IDS):
        if stats.get(stat,0)<0:item['penalties'].append(dict(kind='stat-stage',stat=key,stages=stats[stat],target='self'))
    item['effect']='자신의 '+describe_boost(boosts)+'단계.'
    if item['penalties']:item['effect']+=' 사용 후 '+ ' / '.join(LABELS[KEYS.index(p['stat'])]+' '+str(p['stages']) for p in item['penalties'])+'단계.'
    originals.append(item)

# Keep only two high-risk moves with distinct offensive and defensive roles.
created=[]
for key,name,type_id,boosts,cost_stat in [
    ('30300','맞불각오','fire',{'atk':3,'spa':3},'def'),
    ('03030','쇳심다지기','steel',{'def':3,'spd':3},'spe')
]:
    entry=base_entry('custom-boost-'+key,name,type_id,boosts,5,'창작')
    entry['gainTotal']=6
    entry['penalties']=[dict(kind='hp-cost',target='self',fraction=0.5,requiresHpAboveCost=True),dict(kind='stat-stage',target='self',stat=cost_stat,stages=-2)]
    entry['effect']='자신의 '+describe_boost(boosts)+'단계. 최대 HP의 1/2 소모, '+LABELS[KEYS.index(cost_stat)]+' −2단계. HP가 소모량 이하이거나 올릴 능력치가 없으면 실패하며 HP를 소모하지 않습니다.'
    created.append(entry)

assert len({tuple(r['boosts'].get(k,0) for k in KEYS) for r in created})==len(created)
assert all(tuple(r['boosts'].get(k,0) for k in KEYS) not in forbidden for r in created)
assert len({r['name'] for r in created})==len(created)
payload=dict(originals=originals,custom=created,rules=[
 '랭업기는 타입마다 복제하지 않습니다. 각 항목은 고정된 타입과 상승 조합을 하나씩 가집니다.',
 '신규 기본 상승 조합은 원작의 자기 대상 변화기 상승 조합과 겹치지 않게 사전 생성했습니다. 명중·회피 상승은 제외합니다.',
 '창작 랭업기는 맞불각오(공격·특공 +3)와 쇳심다지기(방어·특방 +3) 두 개만 유지합니다.',
 '두 창작 랭업기는 최대 HP의 1/2을 소모하며 각각 방어 또는 스피드가 2단계 내려갑니다.',
 'HP 소모는 반동이 아닙니다. 소모량은 내림·최소 1이며 현재 HP가 소모량 이하이면 실패합니다. 모든 상승 대상이 +6이면 HP 소모 없이 실패합니다.',
 '이 수치들은 과도한 상승을 제한하는 사전 예산 규칙이며 실제 대전 승률을 검증한 결과는 아닙니다.'
],sources=[BASE+'move_names.csv',BASE+'moves.csv',BASE+'move_meta_stat_changes.csv'])
js='(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.StarterRankups=factory();})(typeof globalThis!=="undefined"?globalThis:this,function(){return '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';});\n'
(ROOT/'rankups.js').write_text(js,encoding='utf-8')
print(f'Precomputed {len(originals)} original-based + {len(created)} unique fixed-type custom rankups; excluded {len(forbidden)} original gain patterns.')
