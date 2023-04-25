#!/usr/bin/env bash

uvicorn main:app --host=0.0.0.0 --port=${APP_PORT:-8001} --reload --log-level=debug
