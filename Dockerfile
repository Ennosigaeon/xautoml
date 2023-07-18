FROM jupyter/scipy-notebook:python-3.10

ENV VERSION=0.1.4

COPY dist/xautoml-$VERSION.tar.gz /tmp/

# Data used in examples
COPY examples/ /home/jovyan/automl/

# Install minimal requirements
RUN pip install \
    /tmp/xautoml-$VERSION.tar.gz \
    dswizard~=0.2


