import os
import pickle
import warnings

import pandas as pd
from sklearn.pipeline import Pipeline

input_dir = os.environ['GO_INPUT_DIR']
params_json = os.path.join(input_dir, 'params.json')
X = pd.read_json(params_json)

with open('/data/model.pkl', 'rb') as f:
    pipeline: Pipeline = pickle.load(f)

with warnings.catch_warnings():
    y_pred = pipeline.predict(X)

series = pd.Series(y_pred)
series.to_json('output.json')
