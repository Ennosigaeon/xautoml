"""
@file
@brief Dig into pipelines.
"""
import textwrap
import warnings
from types import MethodType
from typing import Tuple

from sklearn.base import TransformerMixin, ClassifierMixin, RegressorMixin, BaseEstimator
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.pipeline import Pipeline, FeatureUnion

from xautoml.util.auto_sklearn import AutoSklearnUtils
from xautoml.util.flaml import FLAMLUtils


def enumerate_pipeline_models(pipe, coor=None, vs=None):
    """
    Enumerates all the models within a pipeline.

    @param      pipe        *scikit-learn* pipeline
    @param      coor        current coordinate
    @param      vs          subset of variables for the model, None for all
    @return                 iterator on models ``tuple(coordinate, model)``

    See notebook :ref:`visualizepipelinerst`.
    """
    if coor is None:
        coor = (0,)
    if pipe == "passthrough":
        class PassThrough:
            "dummy class to help display"
            pass

        yield coor, PassThrough(), vs
    else:
        yield coor, pipe, vs
        if hasattr(pipe, 'transformer_and_mapper_list') and len(pipe.transformer_and_mapper_list):
            # azureml DataTransformer
            raise NotImplementedError(  # pragma: no cover
                "Unable to handle this specific case.")
        elif hasattr(pipe, 'mapper') and pipe.mapper:
            # azureml DataTransformer
            for couple in enumerate_pipeline_models(pipe.mapper, coor + (0,)):
                yield couple
        elif hasattr(pipe, 'built_features'):  # pragma: no cover
            # sklearn_pandas.dataframe_mapper.DataFrameMapper
            for i, (columns, transformers, _) in enumerate(pipe.built_features):
                if isinstance(columns, str):
                    columns = (columns,)
                if transformers is None:
                    yield (coor + (i,)), None, columns
                else:
                    for couple in enumerate_pipeline_models(transformers, coor + (i,), columns):
                        yield couple
        elif isinstance(pipe, Pipeline):
            for i, (_, model) in enumerate(pipe.steps):
                for couple in enumerate_pipeline_models(model, coor + (i,)):
                    yield couple
        elif isinstance(pipe, ColumnTransformer):
            for i, (_, fitted_transformer, column) in enumerate(pipe.transformers_):
                for couple in enumerate_pipeline_models(
                    fitted_transformer, coor + (i,), column):
                    yield couple
        elif isinstance(pipe, FeatureUnion):
            for i, (_, model) in enumerate(pipe.transformer_list):
                for couple in enumerate_pipeline_models(model, coor + (i,)):
                    yield couple
        elif AutoSklearnUtils.isChoice(pipe):
            for choice in enumerate_pipeline_models(pipe.choice, coor + (0,)):
                yield choice
        elif AutoSklearnUtils.isFeatTypeSplit(pipe):
            for i, (_, fitted_transformer, column) in enumerate(pipe.column_transformer.transformers_):
                for couple in enumerate_pipeline_models(
                    fitted_transformer, coor + (i,), column):
                    yield couple
        elif isinstance(pipe, TransformedTargetRegressor):
            raise NotImplementedError(  # pragma: no cover
                "Not yet implemented for TransformedTargetRegressor.")
        elif isinstance(pipe, (TransformerMixin, ClassifierMixin, RegressorMixin)):
            pass
        elif isinstance(pipe, BaseEstimator):  # pragma: no cover
            pass
        elif FLAMLUtils.isBaseEstimator(pipe):
            pass
        else:
            raise TypeError(  # pragma: no cover
                "pipe is not a scikit-learn object: {}\n{}".format(type(pipe), pipe))


class BaseEstimatorDebugInformation:
    """
    Stores information when the outputs of a pipeline
    is computed. It as added by function
    @see fct alter_pipeline_for_debugging.
    """

    def __init__(self, model):
        self.model = model
        self.inputs = {}
        self.outputs = {}
        self.methods = {}
        if hasattr(model, "transform") and callable(model.transform):
            model._debug_transform = model.transform
            self.methods["transform"] = lambda model, X: model._debug_transform(
                X)
        if hasattr(model, "predict") and callable(model.predict):
            model._debug_predict = model.predict
            self.methods["predict"] = lambda model, X: model._debug_predict(X)
        if hasattr(model, "predict_proba") and callable(model.predict_proba):
            model._debug_predict_proba = model.predict_proba
            self.methods["predict_proba"] = lambda model, X: model._debug_predict_proba(
                X)
        if hasattr(model, "decision_function") and callable(model.decision_function):
            model._debug_decision_function = model.decision_function
            self.methods["decision_function"] = lambda model, X: model._debug_decision_function(
                X)
        if hasattr(model, "get_feature_names_out") and callable(model.get_feature_names_out):
            model._get_feature_names_out = model.get_feature_names_out
            self.methods["get_feature_names_out"] = lambda model, feature_names: model._get_feature_names_out(
                feature_names)

    def __repr__(self):
        """
        usual
        """
        return self.to_str()

    def to_str(self, nrows=5):
        """
        Tries to produce a readable message.
        """
        rows = ['BaseEstimatorDebugInformation({})'.format(
            self.model.__class__.__name__)]
        for k in sorted(self.inputs):
            if k in self.outputs:
                rows.append('  ' + k + '(')
                self.display(self.inputs[k], nrows)
                rows.append(textwrap.indent(
                    self.display(self.inputs[k], nrows), '   '))
                rows.append('  ) -> (')
                rows.append(textwrap.indent(
                    self.display(self.outputs[k], nrows), '   '))
                rows.append('  )')
            else:
                raise KeyError(  # pragma: no cover
                    "Unable to find output for method '{}'.".format(k))
        return "\n".join(rows)

    def display(self, data, nrows):
        """
        Displays the first
        """
        text = str(data)
        rows = text.split('\n')
        if len(rows) > nrows:
            rows = rows[:nrows]
            rows.append('...')
        if hasattr(data, 'shape'):
            rows.insert(0, "shape=%r type=%r" % (data.shape, type(data)))
        else:
            rows.insert(0, "type=%r" % type(data))  # pragma: no cover
        return "\n".join(rows)


def alter_pipeline_for_debugging(pipe):
    """
    Overwrite methods *transform*, *predict*, *predict_proba*
    or *decision_function* to collect the last inputs and outputs
    seen in these methods.

    @param      pipe        *scikit-learn* pipeline

    The object *pipe* is modified, it should be copied
    before calling this function if you need the object
    untouched after that. The prediction is slower.
    See notebook :ref:`visualizepipelinerst`.
    """

    def transform(self, X, *args, **kwargs):
        self._debug.inputs['transform'] = X.copy()
        y = self._debug.methods['transform'](self, X, *args, **kwargs)
        self._debug.outputs['transform'] = y.copy()
        return y

    def predict(self, X, *args, **kwargs):
        self._debug.inputs['predict'] = X.copy()
        y = self._debug.methods['predict'](self, X, *args, **kwargs)
        self._debug.outputs['predict'] = y.copy()
        return y

    def predict_proba(self, X, *args, **kwargs):
        self._debug.inputs['predict_proba'] = X.copy()
        y = self._debug.methods['predict_proba'](self, X, *args, **kwargs)
        self._debug.outputs['predict_proba'] = y.copy()
        return y

    def decision_function(self, X, *args, **kwargs):
        self._debug.inputs['decision_function'] = X.copy()
        y = self._debug.methods['decision_function'](self, X, *args, **kwargs)
        self._debug.outputs['decision_function'] = y.copy()
        return y

    def get_feature_names_out(self, feature_names, *args, **kwargs):
        self._debug.inputs['get_feature_names_out'] = feature_names
        output_features = self._debug.methods['get_feature_names_out'](self, feature_names, *args, **kwargs)
        self._debug.outputs['get_feature_names_out'] = output_features
        return output_features

    new_methods = {
        'decision_function': decision_function,
        'transform': transform,
        'predict': predict,
        'predict_proba': predict_proba,
        'get_feature_names_out': get_feature_names_out
    }

    if hasattr(pipe, '_debug'):
        raise RuntimeError(  # pragma: no cover
            "The same operator cannot be used twice in "
            "the same pipeline or this method was called "
            "a second time.")

    for model_ in enumerate_pipeline_models(pipe):
        model = model_[1]
        model._debug = BaseEstimatorDebugInformation(model)
        for k in model._debug.methods:
            try:
                setattr(model, k, MethodType(new_methods[k], model))
            except AttributeError:  # pragma: no cover
                warnings.warn("Unable to overwrite method '{}' for class "
                              "{}.".format(k, type(model)))


def get_component(coordinate: Tuple[int], step):
    def update_name(name):
        return name if step_name is None else '{}:{}'.format(step_name, name)

    step_name = None
    for idx in coordinate[1:]:
        if isinstance(step, Pipeline):
            n, step = step.steps[idx]
            step_name = update_name(n)
        elif isinstance(step, ColumnTransformer):
            n, step, _ = step.transformers_[idx]
            step_name = update_name(n)
        elif isinstance(step, FeatureUnion):
            n, step = step.transformer_list[idx]
            step_name = update_name(n)
        elif AutoSklearnUtils.isChoice(step):
            step_name = update_name(step.choice.__class__.__module__.split('.')[-1])
            step = step.choice
        elif AutoSklearnUtils.isFeatTypeSplit(step):
            n, step, _ = step.column_transformer.transformers_[idx]
            step_name = update_name(n)
        else:
            raise ValueError(f'Unknown component {step}')
    return step_name, step
