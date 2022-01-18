import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from sklearn.preprocessing import LabelEncoder


def load_data():
    # The first seven answers have to loaded from the first Excel file because MS Forms is too stupid to handle a
    # change in one question...
    df1 = pd.read_excel('XAutoML(1-7).xlsx')
    df2 = pd.read_excel('XAutoML.xlsx').loc[7:, :]

    df1.columns = df2.columns

    questionnaire = pd.concat([df1, df2])

    for c in questionnaire.columns:
        try:
            questionnaire.loc[:, c] = questionnaire.loc[:, c].str.strip()
        except AttributeError:
            pass

    requirements_df = pd.read_excel('task_results.ods', sheet_name='Requirements', skiprows=1)
    requirements_df = requirements_df.drop(index=[24], columns=['Unnamed: 1']).T
    requirements_df.columns = requirements_df.iloc[0]
    requirements_df = requirements_df[1:]

    return questionnaire, requirements_df


def calculate_sus(df: pd.DataFrame):
    encoder = LabelEncoder()
    encoder.classes_ = np.array(['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'])

    invert = [False, False, True, False, True, False, True, False, True, True]

    for c, inv in zip(df.columns, invert):
        df.loc[:, c] = encoder.transform(df.loc[:, c])
        if inv:
            df.loc[:, c] = 4 - df.loc[:, c]

    score = df.mean(axis=0) * 2.5

    print('###### System Usability Score ######')
    print(score)
    print(score.sum())
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

    with pd.option_context('display.precision', 2):
        print('Average card rank')
        print(data.groupby(by='x').mean())

        mean = data.groupby(by=['x', 'role']).mean().reset_index()
        mean = pd.DataFrame({
            'Question': mean['x'].iloc[::3].reset_index(drop=True),
            'Domain Expert': 24 - mean.loc[mean['role'] == 'Domain Expert', 'y'].reset_index(drop=True),
            'Data Scientist': 24 - mean.loc[mean['role'] == 'Data Scientist', 'y'].reset_index(drop=True),
            'AutoML Researcher': 24 - mean.loc[mean['role'] == 'AutoML Researcher', 'y'].reset_index(drop=True),
        })

        print(mean)

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
            '#01': 'Raw Data',
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


questionnaire, requirements_df = load_data()
calculate_sus(questionnaire.iloc[:, 32:42])
plot_priority_distribution(requirements_df)
