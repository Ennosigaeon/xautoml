import joblib
from ConfigSpace.read_and_write import json as config_json
from sklearn.ensemble import VotingClassifier

from xautoml.models import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, ConfigExplanation, \
    Ensemble


def import_dswizard(dswizard: 'dswizard.core.runhistory.RunHistory', ensemble: VotingClassifier) -> RunHistory:
    """
    Import the RunHistory from a dswizard optimization run. In addition, the final ensemble has to be provided.

    :param dswizard: RunHistory produced by a dswizard optimization run
    :param ensemble: Ensemble constructed by dswizard
    """

    tmp = dswizard.complete_data['meta']
    meta = MetaInformation('dswizard', tmp['start_time'], tmp['end_time'], tmp['metric'], tmp['is_minimization'],
                           tmp['n_structures'], tmp['n_configs'], tmp['incumbent'], tmp['openml_task'],
                           tmp['openml_fold'], tmp['config'])
    default_cs = config_json.read(dswizard.complete_data['default_configspace']) \
        if 'default_configspace' in dswizard.complete_data and dswizard.complete_data['default_configspace'] is not None \
        else None

    structures = []
    for struct in dswizard.data.values():
        configs = []
        for res in struct.results:
            try:
                with open(res.model_file, 'rb') as f:
                    pipeline = joblib.load(f)

                configs.append(Candidate(res.cid.external_name, struct.budget, res.status.name,
                                         res.loss * (1 if meta.is_minimization else -1),
                                         res.runtime.as_dict(), res.config,
                                         res.config.origin if res.config is not None else None,
                                         pipeline, lambda y: y))
            except FileNotFoundError:
                pass
        structures.append(CandidateStructure(struct.cid.without_config().external_name,
                                             struct.configspace, struct.pipeline, configs))

    config_explanations = {}
    for cid, exp in dswizard.complete_data['explanations']['configs'].items():
        config_explanations[cid] = ConfigExplanation(exp['candidates'], exp['loss'], exp['marginalization'])
    explanations = Explanations(dswizard.complete_data['explanations']['structures'], config_explanations)

    # noinspection PyTypeChecker
    ens = Ensemble(ensemble, {cid: ensemble.weights[i] for i, (cid, _) in enumerate(ensemble.estimators)})

    return RunHistory(meta, default_cs, structures, ens, explanations)
