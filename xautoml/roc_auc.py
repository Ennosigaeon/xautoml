import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import roc_curve, auc
from sklearn.preprocessing import label_binarize
from sklearn.utils.multiclass import type_of_target

BINARY = 'binary'
MULTICLASS = 'multiclass'

MACRO = 'macro'
MICRO = 'micro'


# Code based on https://www.scikit-yb.org/en/latest/_modules/yellowbrick/classifier/rocauc.html
class RocCurve:

    def __init__(self, micro: bool = True, macro: bool = False):
        self.micro = micro
        self.macro = macro

    # noinspection PyAttributeOutsideInit
    def score(self, model, X, y=None, json: bool = False):
        '''
        Generates the predicted target values using the Scikit-Learn
        estimator.
        Parameters
        ----------
        model :
        X : ndarray or DataFrame of shape n x m
            A matrix of n instances with m features
        y : ndarray or Series of length n
            An array or series of target or class values
        json :
        Returns
        -------
        score_ : float
            Global accuracy unless micro or macro scores are requested.
        '''
        # Compute the predictions for the test data
        y_pred = model.predict_proba(X)

        ttype = type_of_target(y)
        if ttype.startswith(MULTICLASS):
            self.target_type_ = MULTICLASS
        elif ttype.startswith(BINARY):
            self.target_type_ = BINARY
        else:
            raise ValueError('Unknown target type {}'.format(ttype))

        self.classes = np.unique(y)
        self.n_classes = len(self.classes)

        # Store the false positive rate, true positive rate and curve info.
        self.fpr = dict()
        self.tpr = dict()
        self.roc_auc = dict()

        # If the decision is binary draw only ROC curve for the positive class
        if self.target_type_ is BINARY:
            if (np.array_equal(self.classes, [0, 1]) or
                np.array_equal(self.classes, [-1, 1]) or
                np.array_equal(self.classes, [0]) or
                np.array_equal(self.classes, [-1]) or
                np.array_equal(self.classes, [1])):
                pos_label = 1.0
            else:
                pos_label = self.classes[-1]

            # In this case predict_proba returns an array of shape (n, 2) which
            # specifies the probabilities of both the negative and positive classes.
            if len(y_pred.shape) == 2 and y_pred.shape[1] == 2:
                self.fpr[BINARY], self.tpr[BINARY], _ = roc_curve(y, y_pred[:, 1], pos_label=pos_label)
            else:
                # decision_function returns array of shape (n,), so plot it directly
                self.fpr[BINARY], self.tpr[BINARY], _ = roc_curve(y, y_pred)
            self.roc_auc[BINARY] = auc(self.fpr[BINARY], self.tpr[BINARY])
        else:
            if self.micro:
                self._score_micro_average(y, y_pred)
            elif self.macro:
                # Compute ROC curve for all classes
                for i, c in enumerate(self.classes):
                    self.fpr[i], self.tpr[i], _ = roc_curve(y, y_pred[:, i], pos_label=c)
                    self.roc_auc[i] = auc(self.fpr[i], self.tpr[i])
                self._score_macro_average()
            else:
                raise ValueError('Provide either micro or macro for multiclass')

        if json:
            for key in self.fpr.keys():
                self.fpr[key] = self.fpr[key].tolist()
                self.tpr[key] = self.tpr[key].tolist()

    def _score_micro_average(self, y, y_pred):
        '''
        Compute the micro average scores for the ROCAUC curves.
        '''
        # Convert y to binarized array for micro and macro scores
        y = label_binarize(y, classes=self.classes)
        if self.n_classes == 2:
            y = np.hstack((1 - y, y))

        # Compute micro-average
        self.fpr[MICRO], self.tpr[MICRO], _ = roc_curve(y.ravel(), y_pred.ravel())
        self.roc_auc[MICRO] = auc(self.fpr[MICRO], self.tpr[MICRO])

    def _score_macro_average(self):
        '''
        Compute the macro average scores for the ROCAUC curves.
        '''
        # Gather all FPRs
        all_fpr = np.unique(np.concatenate([self.fpr[i] for i in range(self.n_classes)]))
        avg_tpr = np.zeros_like(all_fpr)

        # Compute the averages per class
        for i in range(self.n_classes):
            avg_tpr += np.interp(all_fpr, self.fpr[i], self.tpr[i])

        # Finalize the average
        avg_tpr /= self.n_classes

        # Store the macro averages
        self.fpr[MACRO] = all_fpr
        self.tpr[MACRO] = avg_tpr
        self.roc_auc[MACRO] = auc(self.fpr[MACRO], self.tpr[MACRO])

    def get_data(self, cid: str = 'ROC'):
        data = []

        # If it's a binary decision, plot the single ROC curve
        if self.target_type_ == BINARY:
            data.append(
                (self.fpr[BINARY], self.tpr[BINARY], cid)
            )
        else:
            if self.micro:
                data.append(
                    (self.fpr[MICRO], self.tpr[MICRO], '{} micro-average'.format(cid))
                )
            if self.macro:
                data.append(
                    (self.fpr[MACRO], self.tpr[MACRO], '{} macro-average'.format(cid))
                )

        return data

    def draw(self):
        '''
        Renders ROC-AUC plot.
        Called internally by score, possibly more than once
        Returns
        -------
        ax : the axis with the plotted figure
        '''

        fig, ax = plt.subplots()
        data = self.get_data()
        for fpr, tpr, label in data:
            ax.plot(fpr, tpr, label=label)

        # Plot the line of no discrimination to compare the curve to.
        lw = 2
        plt.plot([0, 1], [0, 1], color='navy', lw=lw, linestyle='--')
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title('Receiver operating characteristic example')
        plt.legend(loc='lower right')
        plt.show()

        return fig, ax
