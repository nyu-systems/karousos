image-build: Dockerfile
	d=$$(date +%s)\
        ; docker build -f Dockerfile \
        --build-arg USER_ID=$(shell id -u) \
        --build-arg GROUP_ID=$(shell id -g) \
        --target karousos-dev \
        -t karousos-dev . \
        && echo "Image Build took $$(($$(date +%s)-d)) seconds"

container-create: 
	@echo "making container..."
	docker create -it --user $(shell id -u):$(shell id -g) -v ${PWD}/src:/home/karousos/src --env KAR_HOME=/home/karousos --name karousos-dev karousos-dev

karousos-setup: 	
	@echo "Setting up karousos inside the container"
	d=$$(date +%s)\
        ; docker exec -it --user $(shell id -u):$(shell id -g) karousos-dev sh -c "cd src && sh install.sh" \
	&& echo "Karousos installation took $$(($$(date +%s)-d)) seconds"

prepare-apps:
	@echo "Preparing apps"
	d=$$(date +%s)\
        ; docker exec -it --user $(shell id -u):$(shell id -g) karousos-dev sh -c "cd src && sh prepare_app.sh message && sh prepare_app.sh stackTrace && sh prepare_app.sh wiki" \
	&& echo "Preparing apps took $$(($$(date +%s)-d)) seconds"

run-experiments:
	@echo "Running experiments"
	d=$$(date +%s)\
        ; docker exec -it --user $(shell id -u):$(shell id -g) karousos-dev sh -c "cd src/scripts/experiments && sh run_experiments.sh" \
	&& echo "Running experiments took $$(($$(date +%s)-d)) seconds"

run-all-experiments:
	@echo "Running all experiments"
	d=$$(date +%s)\
        ; docker exec -it --user $(shell id -u):$(shell id -g) karousos-dev sh -c "cd src/scripts/experiments && sh run_all_experiments.sh" \
	&& echo "Running experiments took $$(($$(date +%s)-d)) seconds"

container-start: 
	@echo "starting container...";
	docker start karousos-dev

container-stop: 
	@echo "stopping container...";
	docker stop karousos-dev
	docker rm karousos-dev

container-exec:
	@echo "exec-ing into container...";
	docker exec -it --user $(shell id -u):$(shell id -g) karousos-dev bash

produce-results: image-build container-create container-start karousos-setup prepare-apps run-experiments container-stop
