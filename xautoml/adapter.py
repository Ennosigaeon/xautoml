import pickle
from collections import OrderedDict

import joblib
from ConfigSpace import ConfigurationSpace
from sklearn.pipeline import Pipeline

from xautoml.main import RunHistory, MetaInformation, Explanations, CandidateStructure, Candidate, CandidateId
from ConfigSpace.read_and_write import json as config_json


def import_dswizard(dswizard: any) -> RunHistory:
    tmp = dswizard.complete_data['meta']
    meta = MetaInformation('dswizard', tmp['start_time'], tmp['end_time'], tmp['metric'], tmp['is_minimization'],
                           tmp['n_structures'], tmp['n_configs'], tmp['incumbent'], tmp['openml_task'],
                           tmp['openml_fold'], tmp['config'])
    default_cs = config_json.read(dswizard.complete_data['default_configspace']) \
        if dswizard.complete_data['default_configspace'] is not None else None
    explanations = Explanations(dswizard.complete_data['explanations']['structures'])

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
                                         pipeline))
            except FileNotFoundError:
                pass
        structures.append(CandidateStructure(struct.cid.without_config().external_name,
                                             struct.configspace, struct.pipeline, configs))

    return RunHistory(meta, default_cs, structures, explanations)


if __name__ == '__main__':
    with open('/home/marc/phd/code/xautoml/runhistory_31.pkl', 'rb') as f:
        dswizard = pickle.load(f)

        run_history = import_dswizard(dswizard)
