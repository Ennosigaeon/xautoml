import math

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pingouin as pg
import seaborn as sns
from scipy.stats import ttest_ind
from sklearn.preprocessing import LabelEncoder

pd.set_option('display.width', None)


def load_data():
    questionnaire = pd.read_excel('XAutoML.xlsx')

    encoder = LabelEncoder()
    encoder.classes_ = np.array(['strongly disagree', 'disagree', 'neutral', 'agree', 'strongly agree'])

    for c in questionnaire.columns:
        try:
            questionnaire.loc[:, c] = questionnaire.loc[:, c].str.strip().str.lower()
            questionnaire.loc[:, c] = encoder.transform(questionnaire.loc[:, c])
        except (AttributeError, ValueError):
            pass
    questionnaire.columns = questionnaire.columns.str.strip()

    requirements = pd.read_excel('task_results.ods', sheet_name='Requirements', skiprows=1)
    requirements = requirements.drop(index=[24], columns=['Unnamed: 1']).T
    requirements.columns = requirements.iloc[0]
    requirements = requirements[1:]
    requirements = requirements.dropna(axis=0, how='any')

    tasks = pd.read_excel('task_results.ods', sheet_name='Study 2')
    tasks = tasks.dropna(axis=1, how='all').dropna(axis=0, how='all')
    tasks.index = tasks.iloc[:, 2]
    tasks.drop(columns=tasks.columns[:4], inplace=True)

    return questionnaire, requirements, tasks


def calculate_sus(df: pd.DataFrame):
    invert = [False, True, False, True, False, True, False, True, False, True]

    de = df[df['Domain Expert']]
    ar = df[df['AutoML Expert']]
    ds = df[df['ML Expert']]

    def proc_df(df: pd.DataFrame):
        for c, inv in zip(df.columns[:10], invert):
            if inv:
                df.loc[:, c] = 4 - df.loc[:, c]
            df.loc[:, c] = df.loc[:, c] * 2.5
        return df.iloc[:, :10].mean(axis=0), df.iloc[:, :10].sum(axis=1).std()

    all, std_all = proc_df(df)
    de, std_de = proc_df(de)
    ar, std_ar = proc_df(ar)
    ds, std_ds = proc_df(ds)

    print('###### System Usability Score ######')
    df = pd.DataFrame({'de': de, 'ds': ds, 'ar': ar, 'all': all, })
    with pd.option_context('display.precision', 2):
        print(df)
        print(pd.DataFrame({'mean': df.sum(axis=0), 'std': [std_all, std_de, std_ar, std_ds]}))
        print('\n\n')


def print_visual_design(df: pd.DataFrame):
    de = df[df['Domain Expert']].drop(columns=['Role', 'Domain Expert', 'ML Expert', 'AutoML Expert'])
    ar = df[df['AutoML Expert']].drop(columns=['Role', 'Domain Expert', 'ML Expert', 'AutoML Expert'])
    ds = df[df['ML Expert']].drop(columns=['Role', 'Domain Expert', 'ML Expert', 'AutoML Expert'])
    df = df.drop(columns=['Role', 'Domain Expert', 'ML Expert', 'AutoML Expert'])

    mean = pd.DataFrame([de.mean() + 1, ds.mean() + 1, ar.mean() + 1, df.mean() + 1], index=['DE', 'DS', 'AR', 'all']).T
    std = pd.DataFrame([de.std(), ds.std(), ar.std(), df.std()], index=['DE', 'DS', 'AR', 'all']).T

    print('###### Visual Design (tab:usability_results) ######')
    for idx, row in mean.iterrows():
        print(f'{idx} \t\\({row[0]:.2f}\\)\t& \\({row[1]:.2f}\\)\t& \\({row[2]:.2f}\\)\t& \\({row[3]:.2f}\\) \\\\')
    print('\n\n')


def plot_priority_distribution(df: pd.DataFrame, group=True, aggregate=False):
    def calc_user_group(value: str):
        return value.strip().split('.')[0]

    x = []
    y = []
    m = []

    for col in df:
        y.append(df[col].to_list())
        x.append([col] * df.shape[0])
        m.append(df[col].index.map(calc_user_group))

    x = np.array(x).flatten()
    y = 24 - np.array(y).flatten()
    m = np.array(m).flatten()

    data = pd.DataFrame({'x': x, 'y': y, 'role': m})

    if aggregate:
        data['y'] = (data['y'] / 5).astype(int)

    mean = data.groupby(by=['x', 'role']).mean().reset_index()
    offset = data['y'].max() + 1
    mean = pd.DataFrame({
        'Domain Expert': offset - mean.loc[mean['role'] == 'Domain Expert', 'y'].reset_index(drop=True),
        'Data Scientist': offset - mean.loc[mean['role'] == 'Data Scientist', 'y'].reset_index(drop=True),
        'AutoML Researcher': offset - mean.loc[mean['role'] == 'AutoML Researcher', 'y'].reset_index(drop=True),
        'All': offset - data.groupby('x').mean()['y'].reset_index(drop=True)
    })

    print('Average card rank (tab:card_sorting_results)')
    for _, row in mean.iterrows():
        print(f'\\({row[0]:.1f}\\)\t& \\({row[1]:.1f}\\)\t& \\({row[2]:.1f}\\)\t& \\({row[3]:.1f}\\) \\\\')
    print('\n\n')

    if group:
        replacements = {
            '#01': ['#02', '#03', '#04'],
            '#05': ['#06', '#07', '#08'],
            '#09': ['#10', '#11', '#12'],
            '#15': ['#16'],
            '#17': ['#18'],
            '#19': ['#20'],
            '#23': ['#24']
        }

        for key, values in replacements.items():
            for value in values:
                data.loc[data['x'] == value, 'x'] = key

        rename = {
            '#01': 'R01-R04 Input Data',
            '#05': 'R05-R08 Pre-Proc Data',
            '#09': 'R09-R12 Feat-Eng Data',
            '#13': 'R13 Complete Pipeline',
            '#14': 'R14 Search Space',
            '#15': 'R15-R16 Search Strategy',
            '#17': 'R17-R18 Perf Metrics',
            '#19': 'R19-R20 Explanations',
            '#21': 'R21 View HP',
            '#22': 'R22 Comp Perf',
            '#23': 'R23-R24 Comp Pipe',
        }
    else:
        rename = {
            '#01': 'R01 View Input',
            '#02': 'R02 Desc Input',
            '#03': 'R03 Input Stat',
            '#04': 'R04 Plot Input',
            '#05': 'R05 View Pre-Proc',
            '#06': 'R06 Desc Pre-Proc',
            '#07': 'R07 Pre-Proc Stat',
            '#08': 'R08 Plot Pre-Proc',
            '#09': 'R09 View Feat-Eng',
            '#10': 'R10 Feat-Eng Stat',
            '#11': 'R11 Plot Feat-Eng',
            '#12': 'R12 Desc Feat-Eng',
            '#13': 'R13 Complete Pipe',
            '#14': 'R14 Search Space',
            '#15': 'R15 Pipe Search Strat',
            '#16': 'R16 HP Search Strat',
            '#17': 'R17 View Perf Metrics',
            '#18': 'R18 Plot Perf Visual',
            '#19': 'R19 Global Expl',
            '#20': 'R20 Local Expl',
            '#21': 'R21 View HP',
            '#22': 'R22 Comp Perf',
            '#23': 'R23 Comp Pipe',
            '#24': 'R24 Comp HP'
        }

    for old, new in rename.items():
        data.loc[data['x'] == old, 'x'] = new

    # TODO
    # data.loc[data['role'] == 'AutoML Researcher', 'role'] = 'Data Scientist'

    print('Difference between user groups per card')
    for card in data['x'].unique():
        ds = data[(data['x'] == card) & (data['role'] == 'Data Scientist')]
        de = data[(data['x'] == card) & (data['role'] == 'Domain Expert')]
        ar = data[(data['x'] == card) & (data['role'] == 'AutoML Researcher')]

        res = pg.welch_anova(dv='y', between='role', data=data[data['x'] == card])
        if any(res['p-unc'] < 0.05):
            print(f'{card}\n{pg.pairwise_gameshowell(dv="y", between="role", data=data[data["x"] == card])}')

        # t = f_oneway(ds['y'].values, de['y'].values, ar['y'].values)
        # t = ttest_ind(ar['y'].values, de['y'].values)
        # if t.pvalue < 0.05:
        #     print(f'{card} {t.pvalue:.5f}')

    print('\n\n')

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(1, 1, figsize=(15, 5))
    fig.tight_layout()

    sns.violinplot(data=data, x='x', y='y', hue='role', split=False, palette='pastel', ax=ax)
    sns.despine(left=True)

    ax.set_ylim(-1, offset + 1)
    ax.set_yticklabels([])
    ax.set_ylabel(None)
    ax.set_xlabel(None)
    box = ax.get_position()
    ax.set_position([box.x0 + 0.015, box.y0 + box.height * 0.15, box.width, box.height * 0.8])
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, 1.13), ncol=3)
    if group:
        plt.xticks(rotation=15)
        fig.text(0.0125, 0.2, 'least important', rotation=90, va='bottom')
        fig.text(0.0125, 0.95, 'most important', rotation=90, va='top')
        ax.legend(loc='upper center', bbox_to_anchor=(0.5, 1.13), ncol=3)
    else:
        plt.xticks(rotation=25, ha='right', rotation_mode='anchor')
        fig.text(0.025, 0.225, 'least important', rotation=90, va='bottom')
        fig.text(0.025, 0.91, 'most important', rotation=90, va='top')
    fig.show()
    fig.savefig('requirement_cards.pdf')


def calculate_trust_result(text_df: pd.DataFrame, vis_df: pd.DataFrame):
    def cohen_d(x: pd.Series, y: pd.Series):
        nx = len(x)
        ny = len(y)
        dof = nx + ny - 2
        return (x.mean() - y.mean()) / math.sqrt(((nx - 1) * x.std() ** 2 + (ny - 1) * y.std() ** 2) / dof)

    vis_df.columns = text_df.columns
    print('###### Trust (sec:insights + tab:evaluation_results) ######')
    for col in text_df.columns[:5]:
        text = text_df.loc[:, col]
        vis = vis_df.loc[:, col]

        t = ttest_ind(text.values, vis.values, alternative='less')
        print(
            f'{col}, \({text.mean() + 1:.2f} \pm {text.std():.2f}\), \({vis.mean() + 1:.2f} \pm {vis.std():.2f}\), \(p = {t.pvalue:.2e}\), \(d = {cohen_d(text, vis):.2f}\)')

    text_de, vis_de = text_df[text_df['Domain Expert']], vis_df[vis_df['Domain Expert']]
    text_ar, vis_ar = text_df[text_df['AutoML Expert']], vis_df[vis_df['AutoML Expert']]
    text_ds, vis_ds = text_df[text_df['ML Expert']], vis_df[vis_df['ML Expert']]

    for col in text_df.columns[:5]:
        print(col)
        print(
            f'\\({text_de[col].mean() + 1:.2f}\\)\t& \\({text_ds[col].mean() + 1:.2f}\\)\t& \\({text_ar[col].mean() + 1:.2f}\\)\t& \\({text_df[col].mean() + 1:.2f}\\) \\\\')
        print(
            f'\\({vis_de[col].mean() + 1:.2f}\\)\t& \\({vis_ds[col].mean() + 1:.2f}\\)\t& \\({vis_ar[col].mean() + 1:.2f}\\)\t& \\({vis_df[col].mean() + 1:.2f}\\) \\\\')

    print('\n\n')


def calculate_task_success(df: pd.DataFrame):
    encoder = LabelEncoder()
    encoder.classes_ = np.array(['n', 'y', '-'])

    for c in df.columns:
        df.loc[:, c] = encoder.transform(df.loc[:, c])
        df.loc[df[c] == 2, c] = np.nan

    with pd.option_context('display.precision', 0):
        print('Task success percentage (tab:study_tasks)')
        print(df.mean(axis=1) * 100)
        print(df.mean().mean() * 100)
        print('\n\n')


def index(df: pd.DataFrame, slice_) -> pd.DataFrame:
    df2 = df.iloc[:, slice_]
    df2['Role'] = df['Role']
    df2['Domain Expert'] = df['I am a Domain Expert'] > 2
    df2['ML Expert'] = df['I am an ML Expert'] > 2
    df2['AutoML Expert'] = df['I am an AutoML Expert'] > 2
    return df2


questionnaire, requirements, tasks = load_data()
print_visual_design(index(questionnaire, slice(23, 29)))
calculate_sus(index(questionnaire, slice(30, 40)))
plot_priority_distribution(requirements)
calculate_task_success(tasks)
calculate_trust_result(index(questionnaire, slice(11, 16)), index(questionnaire, slice(17, 22)))

print('Correlation ML expertise and understanding of ML model')
print(questionnaire.iloc[:, [8, 12]].corr())
