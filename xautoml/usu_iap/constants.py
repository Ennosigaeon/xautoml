from enum import Enum

ENVIRONMENT_YML_FILE = 'environment.yml'


class ServiceType(Enum):
    Container = 'Container'
    SparkJob = 'SparkJob'


class DeploymentType(Enum):
    PySpark = 'PySpark'
    Python = 'Python'


# NOTE: User Roles from keycloak.conf. Keycloak could contain more roles.
class UserRole(Enum):
    GoIngress = 'go-ingress'
    KatanaAdmin = 'katana-admin'
    KatanaGo = 'katana-go'
    KatanaGuest = 'katana-guest'
    KatanaPowerUser = 'katana-power-user'
    KatanaSpark = 'katana-spark'
    KatanaUser = 'katana-user'
