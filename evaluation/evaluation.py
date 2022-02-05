import math

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from scipy.stats import ttest_ind

from sklearn.preprocessing import LabelEncoder


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

    tasks = pd.read_excel('task_results.ods', sheet_name=0)
    tasks = tasks.dropna(axis=1, how='all').dropna(axis=0, how='all')
    tasks.index = tasks.iloc[:, 0]
    tasks.drop(columns=tasks.columns[:2], inplace=True)

    return questionnaire, requirements, tasks


def calculate_sus(df: pd.DataFrame):
    invert = [False, False, True, False, True, False, True, False, True, True]

    for c, inv in zip(df.columns, invert):
        if inv:
            df.loc[:, c] = 4 - df.loc[:, c]
        df.loc[:, c] = df.loc[:, c] * 2.5

    score = df.sum(axis=1)

    print('###### System Usability Score ######')
    print(df.mean(axis=0))
    print(score.mean(), score.std())
    print('\n\n')


def print_visual_design(df: pd.DataFrame):
    de = df[df['Role'] == 'domain expert']
    ar = df[df['Role'] == 'automl researcher']
    ds = df[df['Role'] == 'data scientist']
    data = pd.DataFrame([de.mean() + 1, ds.mean() + 1, ar.mean() + 1, df.mean() + 1]).T

    print('###### Visual Design ######')
    for _, row in data.iterrows():
        print(f'\\({row[0]:.2f}\\)\t& \\({row[1]:.2f}\\)\t& \\({row[2]:.2f}\\)\t& \\({row[3]:.2f}\\) \\\\')
    print('\n\n')


def print_previous_knowledge(df: pd.DataFrame):
    de = df[df['Role'] == 'domain expert']
    ar = df[df['Role'] == 'automl researcher']
    ds = df[df['Role'] == 'data scientist']
    data = pd.DataFrame([de.mean() + 1, ds.mean() + 1, ar.mean() + 1, df.mean() + 1]).T

    print('###### Previous Knowledge ######')
    for _, row in data.iterrows():
        print(f'\\({row[0]:.2f}\\)\t& \\({row[1]:.2f}\\)\t& \\({row[2]:.2f}\\)\t& \\({row[3]:.2f}\\) \\\\')
    print('\n\n')


def plot_priority_distribution(df: pd.DataFrame, group=True):
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

    mean = data.groupby(by=['x', 'role']).mean().reset_index()
    mean = pd.DataFrame({
        'Domain Expert': 24 - mean.loc[mean['role'] == 'Domain Expert', 'y'].reset_index(drop=True),
        'Data Scientist': 24 - mean.loc[mean['role'] == 'Data Scientist', 'y'].reset_index(drop=True),
        'AutoML Researcher': 24 - mean.loc[mean['role'] == 'AutoML Researcher', 'y'].reset_index(drop=True),
    })

    print('Average card rank')
    for _, row in mean.iterrows():
        print(f'\\({row[0]:.1f}\\)\t& \\({row[1]:.1f}\\)\t& \\({row[2]:.1f}\\) \\\\')
    print('\n\n')

    if group:
        replacements = {
            '#01': ['#02', '#03', '#04'],
            '#05': ['#06', '#07', '#08'],
            '#09': ['#10', '#11', '#12'],
            '#15': ['#16'],
            '#19': ['#20'],
            # '#22': ['#23', '#24']
        }

        for key, values in replacements.items():
            for value in values:
                data.loc[data['x'] == value, 'x'] = key

        rename = {
            '#01': 'Input Data',
            '#05': 'Pre-Proc. Data',
            '#09': 'Feat.-Eng. Data',
            '#13': 'Complete Pipeline',
            '#14': 'Search Space',
            '#15': 'Search Strategy',
            '#17': 'Perf. Metrics',
            '#18': 'Perf. Visual.',
            '#19': 'Explanations',
            '#21': 'View Hyperparam.',
            '#22': 'Comp. Perf.',
            '#23': 'Comp. Pipelines',
            '#24': 'Comp. Hyperparam.'
        }
        for old, new in rename.items():
            data.loc[data['x'] == old, 'x'] = new

    data.loc[data['role'] == 'AutoML Researcher', 'role'] = 'Data Scientist'

    print('Difference between user groups per card')
    for card in data['x'].unique():
        ds = data[(data['x'] == card) & (data['role'] == 'Data Scientist')]
        de = data[(data['x'] == card) & (data['role'] == 'Domain Expert')]

        t = ttest_ind(ds['y'].values, de['y'].values)
        if t.pvalue < 0.05:
            print(f'{card} {t.pvalue:.5f}')

    print('\n\n')

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(1, 1, figsize=(15, 5))
    fig.tight_layout()

    sns.violinplot(data=data, x='x', y='y', hue='role', split=True, palette='pastel', ax=ax)
    sns.despine(left=True)

    ax.set_ylim(0, 24)
    ax.set_yticklabels([])
    ax.set_ylabel(None)
    ax.set_xlabel(None)
    plt.xticks(rotation=15)

    fig.text(0.0125, 0.2, 'least important', rotation=90, va='bottom')
    fig.text(0.0125, 0.95, 'most important', rotation=90, va='top')

    box = ax.get_position()
    ax.set_position([box.x0, box.y0 + box.height * 0.125, box.width, box.height * 0.875])
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.15), ncol=2)

    fig.show()
    fig.savefig('requirement_cards.pdf')


def calculate_trust_result(text_df: pd.DataFrame, vis_df: pd.DataFrame):
    def cohen_d(x: pd.Series, y: pd.Series):
        nx = len(x)
        ny = len(y)
        dof = nx + ny - 2
        return (x.mean() - y.mean()) / math.sqrt(((nx - 1) * x.std() ** 2 + (ny - 1) * y.std() ** 2) / dof)

    vis_df.columns = text_df.columns
    print('###### Trust ######')
    for col in text_df:
        if col == 'Role':
            continue

        text = text_df.loc[:, col]
        vis = vis_df.loc[:, col]

        t = ttest_ind(text.values, vis.values, alternative='less')
        print(
            f'{col}, \({text.mean() + 1:.2f} \pm {text.std():.2f}\), \({vis.mean() + 1:.2f} \pm {vis.std():.2f}\), \(p = {t.pvalue:.2e}\), \(d = {cohen_d(text, vis):.2f}\)')

    text_de, vis_de = text_df[text_df['Role'] == 'domain expert'], vis_df[vis_df['Role'] == 'domain expert']
    text_ar, vis_ar = text_df[text_df['Role'] == 'automl researcher'], vis_df[vis_df['Role'] == 'automl researcher']
    text_ds, vis_ds = text_df[text_df['Role'] == 'data scientist'], vis_df[vis_df['Role'] == 'data scientist']

    for col in text_df:
        if col == 'Role':
            continue
        print(
            f'\\({text_de[col].mean() + 1:.2f}\\)\t& \\({text_ds[col].mean() + 1:.2f}\\)\t& \\({text_ar[col].mean() + 1:.2f}\\)\t& \\({text_df[col].mean() + 1:.2f}\\) \\\\')
        print(
            f'\\({vis_de[col].mean() + 1:.2f}\\)\t& \\({vis_ds[col].mean() + 1:.2f}\\)\t& \\({vis_ar[col].mean() + 1:.2f}\\)\t& \\({vis_df[col].mean() + 1:.2f}\\) \\\\')

    print('\n\n')


def calculate_task_success(df: pd.DataFrame):
    encoder = LabelEncoder()
    encoder.classes_ = np.array(['n', 'y'])

    for c in df.columns:
        df.loc[:, c] = encoder.transform(df.loc[:, c])

    with pd.option_context('display.precision', 0):
        print('Task success percentage')
        print(df.mean(axis=1) * 100)
        print(df.mean().mean() * 100)
        print('\n\n')


def index(df: pd.DataFrame, slice_) -> pd.DataFrame:
    df2 = df.iloc[:, slice_]
    df2['Role'] = df['Role']
    return df2


questionnaire, requirements, tasks = load_data()
print_visual_design(index(questionnaire, slice(27, 32)))
print_previous_knowledge(index(questionnaire, slice(6, 11)))
calculate_sus(index(questionnaire, slice(32, 42)))
plot_priority_distribution(requirements)
calculate_task_success(tasks)
calculate_trust_result(index(questionnaire, slice(14, 20)), index(questionnaire, slice(20, 26)))

print('Correlation ML expertise and understanding of ML model')
print(questionnaire.iloc[:, [6, 15]].corr())
