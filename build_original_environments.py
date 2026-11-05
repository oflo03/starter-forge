"""Keep original Korean names and move parameters in a static, offline catalog."""
import csv, io, json, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent
BASE='https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
def csv_rows(name):
    path=ROOT/'references'/'pokeapi'/name
    if not path.exists():path.write_bytes(urllib.request.urlopen(BASE+name).read())
    return list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8'))))
move_names={r['move_id']:r['name'] for r in csv_rows('move_names.csv') if r['local_language_id']=='3'}
move_data={r['identifier']:r for r in csv_rows('moves.csv')}
ability_names={r['ability_id']:r['name'] for r in csv_rows('ability_names.csv') if r['local_language_id']=='3'}
ability_data={r['identifier']:r for r in csv_rows('abilities.csv')}
types={1:'normal',2:'fighting',3:'flying',4:'poison',5:'ground',6:'rock',7:'bug',8:'ghost',9:'steel',10:'fire',11:'water',12:'grass',13:'electric',14:'psychic',15:'ice',16:'dragon',17:'dark',18:'fairy'}
environments=[];moves=[];abilities=[]
def move(identifier,effect,**extra):
    r=move_data[identifier];name=move_names[r['id']]
    result=dict(id='original-'+identifier,templateId='original-environment',name=name,type=types[int(r['type_id'])],category={'1':'변화','2':'물리','3':'특수'}[r['damage_class_id']],power=int(r['power'] or 0),accuracy=int(r['accuracy']) if r['accuracy'] else None,pp=int(r['pp']),priority=int(r['priority']),effect=effect,source='원작 기반',referenceName=name,referenceId=int(r['id']),original=True,tags=[],setsEnvironment=[],requiresEnvironment=[],**extra)
    moves.append(result);return result
def environment(id,name,type,affinity,identifier,effect,mechanics,kind,**extra):
    item=dict(id=id,name=name,type=type,affinity=affinity,kind=kind,duration=None if kind=='설치물' else 5,effect=effect,mechanics=mechanics,source='원작 기반',**extra)
    setter=move(identifier,effect)
    setter.update(setsEnvironment=[id],environmentId=id,tags=['setter',id.split('-')[0]])
    if kind=='공간 변화':setter['effect']='5턴 동안 '+effect+' 같은 룸 재사용 시 해제.'
    item['setterMoveId']=setter['id'];environments.append(item)
    return id
sun=environment('weather-sun','강한 햇살','fire',['fire','grass'],'sunny-day','불꽃 공격 ×1.5, 물 공격 ×0.5. 솔라빔·솔라블레이드 충전 생략. 햇빛 회복기 회복 2/3. 동결 방지.',dict(damage=dict(fire=1.5,water=0.5),weatherBallType='fire',solarChargeSkipped=True,recoveryFraction=2/3,recoveryMoves=['아침햇살','달빛','광합성'],reducedAccuracyMoves=['번개','폭풍']), '날씨')
rain=environment('weather-rain','비','water',['water','electric','flying'],'rain-dance','물 공격 ×1.5, 불꽃 공격 ×0.5. 번개·폭풍 필중. 솔라빔·솔라블레이드 위력 절반, 햇빛 회복기 회복 1/4.',dict(inherits='rain',damage=dict(water=1.5,fire=0.5),weatherBallType='water',alwaysHitMoves=['번개','폭풍'],solarBeamPower=0.5,recoveryFraction=0.25,recoveryMoves=['아침햇살','달빛','광합성']), '날씨')
sand=environment('weather-sandstorm','모래바람','rock',['rock','ground','steel'],'sandstorm','턴 종료에 바위·땅·강철 외 HP 1/16 피해. 바위 타입 특방 ×1.5. 솔라빔·솔라블레이드 위력 절반, 햇빛 회복기 회복 1/4.',dict(weatherBallType='rock',endTurnDamage=dict(immuneTypes=['rock','ground','steel'],fraction=1/16),statBoost=dict(types=['rock'],stat='spd',multiplier=1.5),solarBeamPower=0.5,recoveryFraction=0.25,recoveryMoves=['아침햇살','달빛','광합성']), '날씨')
snow=environment('weather-snow','눈','ice',['ice'],'snowscape','얼음 타입 방어 ×1.5. 눈보라 필중. 날씨 피해 없음. 솔라빔·솔라블레이드 위력 절반, 햇빛 회복기 회복 1/4.',dict(weatherBallType='ice',statBoost=dict(types=['ice'],stat='def',multiplier=1.5),alwaysHitMoves=['눈보라'],solarBeamPower=0.5,recoveryFraction=0.25,recoveryMoves=['아침햇살','달빛','광합성']), '날씨')
hail=environment('weather-hail','싸라기눈','ice',['ice'],'hail','구세대 날씨. 턴 종료에 얼음 외 HP 1/16 피해. 눈보라 필중. 솔라빔·솔라블레이드 위력 절반, 햇빛 회복기 회복 1/4.',dict(weatherBallType='ice',endTurnDamage=dict(immuneTypes=['ice'],fraction=1/16),alwaysHitMoves=['눈보라'],solarBeamPower=0.5,recoveryFraction=0.25,recoveryMoves=['아침햇살','달빛','광합성']), '날씨',legacy=True)
electric=environment('terrain-electric','일렉트릭필드','electric',['electric'],'electric-terrain','접지한 사용자의 전기 공격 ×1.3. 접지한 포켓몬의 수면 방지.',dict(appliesToAirborne=False,damage=dict(electric=1.3),preventsStatus=['sleep']), '필드')
grassy=environment('terrain-grassy','그래스필드','grass',['grass'],'grassy-terrain','접지한 사용자의 풀 공격 ×1.3. 접지한 포켓몬은 턴 종료에 HP 1/16 회복. 접지한 대상이 받는 지진·땅고르기·매그니튜드 피해 절반.',dict(appliesToAirborne=False,damage=dict(grass=1.3),endTurnHeal=1/16,halfDamageMoves=['지진','땅고르기','매그니튜드']), '필드')
misty=environment('terrain-misty','미스트필드','fairy',['fairy','dragon'],'misty-terrain','접지한 대상의 상태이상·혼란 방지. 접지한 대상이 받는 드래곤 공격 피해 절반.',dict(appliesToAirborne=False,targetDamage=dict(dragon=0.5),preventsStatus=['all','confusion']), '필드')
psychic=environment('terrain-psychic','사이코필드','psychic',['psychic'],'psychic-terrain','접지한 사용자의 에스퍼 공격 ×1.3. 접지한 대상을 향한 상대 우선도 양수 기술 차단.',dict(appliesToAirborne=False,damage=dict(psychic=1.3),blocksPriority=True), '필드')
trick=environment('room-trick','트릭룸','psychic',['psychic','ghost','steel'],'trick-room','같은 우선도에서 느린 포켓몬부터 행동. 우선도 자체는 유지.',dict(changesSpeedOrder=True,slot='room-trick'),'공간 변화')
magic=environment('room-magic','매직룸','psychic',['psychic','dark'],'magic-room','모든 포켓몬의 지닌 도구 효과 무효.',dict(suppressItems=True,slot='room-magic'),'공간 변화')
wonder=environment('room-wonder','원더룸','psychic',['psychic','rock','steel'],'wonder-room','모든 포켓몬의 방어·특방 수치를 교환. 각 능력치 단계는 그대로.',dict(swapDefenses=True,slot='room-wonder'),'공간 변화')
spikes=environment('hazard-spikes','압정뿌리기','ground',['ground','steel'],'spikes','상대 진영에 최대 3겹. 접지한 포켓몬 등장 시 HP 1/8·1/6·1/4 피해.',dict(maxLayers=3,groundedOnly=True,damageByLayers=[1/8,1/6,1/4],side='foe'),'설치물')
toxic=environment('hazard-toxic-spikes','독압정','poison',['poison'],'toxic-spikes','상대 진영에 최대 2겹. 접지한 상대 등장 시 1겹은 독, 2겹은 맹독. 접지한 독 타입이 흡수·제거. 강철은 독 면역.',dict(maxLayers=2,groundedOnly=True,statusByLayers=['poison','toxic'],absorbedBy=['poison'],immuneTypes=['poison','steel'],side='foe'),'설치물')
rocks=environment('hazard-stealth-rock','스텔스록','rock',['rock','ground','steel'],'stealth-rock','상대 진영에 1회 설치. 등장한 포켓몬에게 최대 HP 1/8 × 바위 상성 피해. 공중도 적용.',dict(maxLayers=1,groundedOnly=False,damageFraction=1/8,damageType='rock',side='foe'),'설치물')
web=environment('hazard-sticky-web','끈적끈적네트','bug',['bug'],'sticky-web','상대 진영에 1회 설치. 접지한 상대 등장 시 스피드 −1단계.',dict(maxLayers=1,groundedOnly=True,boosts=dict(spe=-1),side='foe'),'설치물')
hazards=[spikes,toxic,rocks,web]
for identifier,effect,extra in [
    ('rapid-spin','명중 시 자기 진영 설치물·씨뿌리기·조이기 해제, 자신의 스피드 +1.',dict(clearsEnvironment=hazards)),
    ('defog','대상 회피 −1. 양 진영 설치물·필드와 대상 진영의 장막 제거.',dict(clearsEnvironment=hazards+[electric,grassy,misty,psychic,'terrain-ant-colony','terrain-octagon','terrain-white-paint','terrain-swamp'])),
    ('court-change','양 진영의 설치물·장막·순풍 등 진영 효과를 서로 교환.',dict(swapsSideConditions=True)),
    ('tidy-up','양쪽 설치물·대타출동 제거. 자신의 공격·스피드 +1.',dict(clearsEnvironment=hazards)),
    ('aurora-veil','눈·싸라기눈에서 사용. 5턴 동안 아군이 받는 공격 피해를 싱글 1/2, 더블 2/3로 감소.',dict(worksWith=[snow,hail])),
    ('thunder','비·뇌우에서 필중, 강한 햇살에서는 명중 50. 30% 마비.',dict(worksWith=[rain,'weather-thunderstorm',sun])),
    ('hurricane','비·뇌우에서 필중, 강한 햇살에서는 명중 50. 30% 혼란.',dict(worksWith=[rain,'weather-thunderstorm',sun],tags=['wind'])),
    ('blizzard','눈·싸라기눈에서 필중. 10% 동결.',dict(worksWith=[snow,hail])),
    ('solar-beam','1턴 충전 후 공격. 강한 햇살에서는 즉시 공격, 비·뇌우·모래바람·눈·싸라기눈·어두운 오라·조용한 안개에서는 위력 절반.',dict(worksWith=[sun])),
    ('solar-blade','1턴 충전 후 공격. 날씨에 따른 충전·위력 보정은 솔라빔과 동일.',dict(worksWith=[sun])),
    ('expanding-force','접지한 사용자가 사이코필드에서 사용하면 위력 ×1.5, 상대 전체 공격.',dict(worksWith=[psychic])),
    ('rising-voltage','일렉트릭필드에서 접지한 대상을 공격하면 위력 ×2.',dict(worksWith=[electric])),
    ('grassy-glide','접지한 사용자는 그래스필드에서 우선도 +1.',dict(worksWith=[grassy])),
    ('misty-explosion','사용 후 기절. 접지한 사용자는 미스트필드에서 위력 ×1.5.',dict(worksWith=[misty])),
    ('morning-sun','HP 1/2 회복. 강한 햇살에서는 2/3, 다른 날씨에서는 1/4.',dict(worksWith=[sun],tags=['heal'])),
    ('synthesis','HP 1/2 회복. 강한 햇살에서는 2/3, 다른 날씨에서는 1/4.',dict(worksWith=[sun],tags=['heal'])),
    ('moonlight','HP 1/2 회복. 강한 햇살에서는 2/3, 다른 날씨에서는 1/4.',dict(worksWith=[sun],tags=['heal'])),
]:
    tags=extra.pop('tags',[]);m=move(identifier,effect,**extra);m['tags']=tags
    if identifier=='grassy-glide':m['power']=55

def ability(identifier,type,affinity,effect,**extra):
    r=ability_data[identifier];name=ability_names[r['id']]
    item=dict(id=identifier,name=name,type=type,affinity=affinity,description=effect,source='원작 기반',referenceName=name,referenceId=int(r['id']),original=True,tags=[],setsEnvironment=[],requiresEnvironment=[])
    item.update(extra);abilities.append(item);return item
for identifier,type,affinity,id in [('drought','fire',['fire','grass'],sun),('drizzle','water',['water','electric'],rain),('sand-stream','rock',['rock','ground','steel'],sand),('snow-warning','ice',['ice'],snow),('electric-surge','electric',['electric'],electric),('grassy-surge','grass',['grass'],grassy),('misty-surge','fairy',['fairy'],misty),('psychic-surge','psychic',['psychic'],psychic)]:
    name=next(e['name'] for e in environments if e['id']==id)
    ability(identifier,type,affinity,'등장 시 '+name+' 5턴 생성.',tags=[id.split('-')[0],'setter'],setsEnvironment=[id])
for identifier,type,affinity,envs in [('chlorophyll','grass',['grass'],[sun]),('swift-swim','water',['water'],[rain,'weather-thunderstorm']),('sand-rush','ground',['ground','rock','steel'],[sand]),('slush-rush','ice',['ice'],[snow,hail]),('surge-surfer','electric',['electric'],[electric])]:
    names='·'.join(next(e['name'] for e in environments if e['id']==id) if id!='weather-thunderstorm' else '뇌우' for id in envs)
    ability(identifier,type,affinity,names+' 동안 스피드 ×2.',tags=['beneficiary','fast'],requiresEnvironment=[envs[0]],activeEnvironments=envs,statModifier=dict(stat='spe',multiplier=2,groundedOnly=False))
    if identifier=='sand-rush':
        abilities[-1]['description']+=' 모래바람 피해 면역.'
        abilities[-1]['weatherResidualImmunity']=[sand]
ability('solar-power','fire',['fire','grass'],'강한 햇살에서 특공 ×1.5, 턴 종료에 최대 HP 1/8 피해.',tags=['beneficiary','special'],requiresEnvironment=[sun],activeEnvironments=[sun],statModifier=dict(stat='spa',multiplier=1.5))
ability('sand-force','ground',['ground','rock','steel'],'모래바람에서 땅·바위·강철 기술 피해 ×1.3, 모래바람 피해 면역.',tags=['beneficiary'],requiresEnvironment=[sand],activeEnvironments=[sand],attackModifier=dict(types=['ground','rock','steel'],multiplier=1.3))
abilities[-1]['weatherResidualImmunity']=[sand]
ability('rain-dish','water',['water','grass'],'비·뇌우에서 턴 종료에 최대 HP 1/16 회복.',tags=['beneficiary','heal'],requiresEnvironment=[rain],activeEnvironments=[rain,'weather-thunderstorm'])
ability('ice-body','ice',['ice'],'눈·싸라기눈에서 턴 종료에 최대 HP 1/16 회복, 싸라기눈 피해 면역.',tags=['beneficiary','heal'],requiresEnvironment=[snow],activeEnvironments=[snow,hail])
ability('grass-pelt','grass',['grass'],'그래스필드에서 방어 ×1.5. 접지 여부 무관.',tags=['beneficiary','bulky'],requiresEnvironment=[grassy],activeEnvironments=[grassy],statModifier=dict(stat='def',multiplier=1.5))
ability('toxic-debris','poison',['poison','rock'],'물리 공격을 받으면 상대 진영에 독압정 1겹 설치. 최대 2겹.',tags=['hazard','setter','physical-bulk'],setsEnvironment=[toxic])
ability('magic-bounce','psychic',['psychic','fairy','dark'],'반사 가능한 변화기를 반사. 압정류도 포함.',tags=['hazard','support'])
ability('magic-guard','psychic',['psychic','fairy'],'직접 공격 이외의 피해를 받지 않음. 설치물·날씨·상태이상 피해 포함. HP 지불은 제외.',tags=['hazard','bulky'])
ability('levitate','flying',['flying','psychic','ghost','electric'],'공중에 떠서 땅 공격 면역. 접지형 설치물·원작 필드의 접지 조건에도 적용.',tags=['hazard','support'])
ability('overcoat','normal',['normal','grass','bug','steel'],'모래바람·싸라기눈 피해와 가루·포자 기술 면역.',tags=['weather','bulky'])
ability('cloud-nine','normal',['normal','water'],'필드에 있는 동안 날씨 효과를 무효화. 날씨 자체는 유지.',tags=['weather','support'],suppressesWeather=True)
ability('air-lock','dragon',['dragon','flying'],'필드에 있는 동안 날씨 효과를 무효화. 날씨 자체는 유지.',tags=['weather','support'],suppressesWeather=True)
sources=[BASE+f for f in ['move_names.csv','moves.csv','ability_names.csv','abilities.csv']]+['https://github.com/smogon/pokemon-showdown/blob/master/data/conditions.ts','https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts','https://github.com/smogon/pokemon-showdown/blob/master/data/abilities.ts']
data=dict(environments=environments,moves=moves,abilities=abilities,sources=sources)
(ROOT/'original-environments.js').write_text('(function(root,factory){if(typeof module===\'object\'&&module.exports)module.exports=factory();else root.StarterOriginalEnvironments=factory();})(typeof globalThis!==\'undefined\'?globalThis:this,function(){return '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';});\n',encoding='utf-8')
print(f'Original catalog: {len(environments)} environments, {len(moves)} moves, {len(abilities)} abilities.')
