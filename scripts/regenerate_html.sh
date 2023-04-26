#!/usr/bin/env bash
pushd ../data
for d in $(ls -d *); do
  cp ../public/viz_template.html ../public/$d.html
  perl -pi -e "s|\@PROJECT_ID\@|$d|" ../public/$d.html
done
popd
