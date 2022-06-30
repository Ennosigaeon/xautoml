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
