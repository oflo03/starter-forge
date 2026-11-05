"""Plot the actual constrained 10,000-sample distribution, without resampling."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

root = Path(__file__).resolve().parent
report = json.loads((root / 'distribution/distribution.json').read_text(encoding='utf-8'))
plt.rcParams.update({'font.family': 'Malgun Gothic', 'axes.unicode_minus': False,
                     'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False,
                     'axes.edgecolor': '#b7c2c7', 'axes.labelcolor': '#38464d',
                     'xtick.color': '#53636b', 'ytick.color': '#53636b',
                     'svg.fonttype': 'none', 'savefig.facecolor': '#ffffff'})
fig, axes = plt.subplots(2, 3, figsize=(15, 8.7), sharex=True, sharey=True)
edges = np.arange(-0.5, 170.5, 5)
peaks = []
for ax, stat in zip(axes.flat, report['summary']):
    values = np.arange(256)
    counts, _ = np.histogram(values, bins=edges, weights=stat['bins'])
    percentages = counts / report['count'] * 100
    peaks.append(percentages.max())
    ax.axvspan(-.5, stat['midpoint']-stat['radius'], color='#f2f5f6', zorder=0)
    ax.axvspan(stat['midpoint']+stat['radius'], 169.5, color='#f2f5f6', zorder=0)
    ax.bar(edges[:-1]+2.5, percentages, width=4.55, color='#1b6c80', linewidth=0, zorder=3)
    ax.axvline(stat['midpoint'], color='#a57420', lw=1.4, ls=(0,(4,3)), label='기준 중간점')
    ax.axvline(stat['mean'], color='#18313e', lw=1.1, label='표본 평균')
    c_label = f"c 아래 {stat['c']:.1f} / 위 {stat['cAbove']:.1f}" if 'cAbove' in stat else f"c = {stat['c']:.2f}"
    ax.set_title(f"{stat['stat'].upper()} · {stat['label']}     {c_label}",loc='left',fontweight='bold',pad=13)
    ax.text(.02, .96, f"평균 {stat['mean']:.2f}   중앙값 {stat['median']:.0f}   표준편차 {stat['sd']:.2f}\n"
            f"허용 {stat['midpoint']-stat['radius']}–{stat['midpoint']+stat['radius']}   관측 {stat['min']}–{stat['max']}",
            transform=ax.transAxes, va='top', color='#44565e', fontsize=9, linespacing=1.65,
            bbox={'facecolor':'white','alpha':.90,'edgecolor':'none','pad':3})
    ax.set_xlim(-.5,169.5)
    ax.grid(axis='y',color='#e6edef',lw=.6,zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(axis='both',length=3)
for ax in axes.flat:
    ax.set_ylim(0, max(peaks)*1.40)
for ax in axes[-1]: ax.set_xlabel('종족값 · 5점 단위 구간')
for ax in axes[:,0]: ax.set_ylabel('전체 10,000개 중 비율 (%)')
axes[0,0].legend(frameon=False,loc='upper right',bbox_to_anchor=(1.01,.81),fontsize=8)
fig.suptitle('530 종족값 순차 추첨 · 10,000회 실측 분포',x=.06,ha='left',fontsize=20,fontweight='bold',y=.98)
fig.text(.06,.925,'능력치 순서를 매번 무작위로 선택 · 지정 범위 안에서 중간점 재조정 · 마지막 능력치는 잔여값 배정',fontsize=11,color='#4c5e66')
fig.text(.06,.037,'모든 표본의 합계 = 530  |  범위 위반 = 0  |  HP·방어·특방: 조정 중간점 아래 c=0.1, 위 c=0.5',fontsize=10,color='#244b5a')
fig.text(.06,.010,'아래·위 방향은 50:50 추첨 후 반쪽 분포를 적용합니다. 총합 제약·중간점 이동·마지막 잔여 배정은 최종 분포에도 영향을 줍니다.',fontsize=9,color='#61727a')
fig.subplots_adjust(left=.06,right=.98,top=.85,bottom=.11,wspace=.13,hspace=.34)
out=root/'distribution'
fig.savefig(out/'stat-distributions.png',dpi=180)
fig.savefig(out/'stat-distributions.svg')
plt.close(fig)
print(out/'stat-distributions.png')
