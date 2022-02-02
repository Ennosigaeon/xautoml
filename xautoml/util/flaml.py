class FLAMLUtils:

    @staticmethod
    def isBaseEstimator(pipe):
        try:
            from flaml.model import BaseEstimator
            return isinstance(pipe, BaseEstimator)
        except ImportError:
            return False
