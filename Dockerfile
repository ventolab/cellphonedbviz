FROM python:3.9-slim

# install git for pulling cellphonedbviz (git+https://repo@branch)
RUN apt-get update && apt-get install -y --no-install-recommends git
RUN apt-get -y install gcc

WORKDIR /cellphonedbviz

# install requirements first so other code changes
# don't break cache for this layer
COPY requirements.txt .
RUN pip install --no-cache-dir --requirement requirements.txt

# copy rest of the app
COPY . ./

# default command is to strat the site
CMD /cellphonedbviz/run.sh
