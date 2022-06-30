# IAP Go Deployment

XAutoML can be connected with the USU IAP to create deployments of selected models.

## Configure JupyterLab

You have to provide an offline token to authenticate yourself against IAP. The offline token can be either passed
as a command line argument

```
jupyter lab --IAPAuth.offline_token=...
```

or in a Jupyter configuration file (see [here](https://docs.jupyter.org/en/latest/use/config.html)). Further
configuration options are listed in `iap_service.py`.

## Calling the deployment

After creating a deployment successfully, it can be invoked via a REST client. The following script is an example how
to predict `iris` classifications.

```python

import requests
from traitlets.config import Config

from xautoml.usu_iap.iap_service import IAPAuth

data = {
    "sepal.length": {
        "0": 5.1,
        "1": 4.9
    },
    "sepal.width": {
        "0": 3.5,
        "1": 3.0
    },
    "petal.length": {
        "0": 1.4,
        "1": 1.4
    },
    "petal.width": {
        "0": 0.2,
        "1": 0.2
    }
}

c = Config()
c.IAPAuth.offline_token = '...'
auth = IAPAuth(config=c)

r = requests.post('https://dev.katana.cloud/katana-go/call/container/sync/iris/12',
                  headers={'Authorization': f'Bearer {auth.get_token()}'},
                  json=data)

print(r.text)


```

