FROM jupyter/scipy-notebook:2022-05-09

ENV VERSION=0.1.3

COPY dist/xautoml-$VERSION.tar.gz /tmp/

# Data used in examples
COPY examples/ /home/jovyan/automl/

# Install minimal requirements
RUN pip install \
    /tmp/xautoml-$VERSION.tar.gz \
    dswizard~=0.2


