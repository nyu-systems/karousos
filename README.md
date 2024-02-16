# Karousos: Efficient auditing of event-driven web applications

## Setting up the environment

### Using docker 

All following instructions should be run from inside `src`.
 
To run karousos, the experiments and develop inside a docker container, run 

```text
make image-build # Create the image. Takes about 20 mins
make container-create # Create the karousos-dev container
make container-start # Start the karousos-dev container
make karousos-setup # Install karousos libraries
make prepare-apps # Compile all applications and prepare to run the experiments. Takes about 45 minutes.
```

Once you have running container, you can get a terminal inside the container by executing:

```text
make container-exec
```

Or you can run the experiments with:

```text
make run-experiments
```

The above command will run all experiments for the server and the verifier and produce the data for 
graphs 6 (written in `src/scripts/experiments/kserver_vs_orig/csv_files`, 
compare with the data used in the paper under `data-used-in-submission/server`), 
7 (written in `src/scripts/experiments/kver_vs_orig_concurrent_reqs/csv_files_ver`, 
compare with the data used in the paper under `data-used-in-submission/verifier`), 
and 8 (written in `src/scripts/experiments/kver_vs_orig_concurrent_reqs/csv_files_advice`, 
compare with the data used in the paper under `data-used-in-submission/advice`)
of the paper. It takes approximately 15 hours to run all experiments.

If you also want to produce the data for the experiments in the appendix, execute the command:
 
```text
make run-all-experiments
```

To stop the container run:

```text
make container-stop
```

You can also automatically run all above steps by executing:
```test 
make produce-results
```
which will create the image, start the container, install Karousos dependencies, prepare and run the
experiments. 

Note: The above commands might requre sudo access. To execute docker without sudo, 
you need to change the permission of /var/run/docker.sock to 666, i.e. 
```test 
chmod 666 /var/run/docker.sock
```

### In your machine

#### Requirements
	
- Node v12.16.1
- NPM 6.13.4
- MySql 8.0.19

##### Installation/Configuration

Export a variable `KAR_HOME` that should be set to the 
location of the karousos repository in the local file system. This 
path should NOT end with '/' e.g. it can be `~/karousos` but not `~/karousos/`

Also export a variable `MYSQL_INSTALL_LOC` that should be set to the folder where mysql 
is installed. This location should be in the user space (i.e. accessing the directories in 
this folder should not require sudo access). 

Check `mysql_binlog/README.md` for instructions on how to set up the MySQL database. 

Go to karousos/src and run `./install.sh` (this installs the libraries)	

# Contents of this directory: 
- `compiler`: it contains the transpiler plugin and functions that we use 
to transpile the application code 
- `server-lib`: the library that contains the functions that the 
server executes to produce advice
- `verifier-lib`: the library that contains the functions that the 
verifier executes to do SIMD and read from the advice/reports	
- `annotated_libs`: the libraries we have annotated
- `apps`: the applications. The annotated code for application `app_name` should 
be `apps/app_name_annotated`
- `workloads`: the workloads that we are running our applications on. 
Each workload is in a directory `workloads/app_name/workload_name`. 
	
# Running the code 

## Transpiling the application's code

All following instructions should be run from inside `src`.

Run 

```text
./compile.sh app_name 
```

to produce the server code for application `app_name` that is in `$KAR_HOME/apps/`. 
The new code is placed in `$KAR_HOME/apps/app_name-prover`.

Run 

```text
./compile.sh app_name 1 
```

to produce the verifier code for application `app_name` that is in `$KAR_HOME/apps/`.
The new code is placed in `$KAR_HOME/apps/app_name-verifier`. 

In both cases, the new code is created in a new folder. Only the main file 
(`$KAR_HOME/apps/app_name/app.js`) is compiled. 
The rest of the code (e.g. the node modules) is compiled on demand during the 
first execution of the application's code. 
To fully compile an application for the server and the verifier, you can run:

```text
./prepare_app.sh app_name 
```

This produces the code for the server and the verifier by running compile.sh and 
running the code for the server and the code for the verifier once to produce 
the compiled full code. NOTE: this requires the existence of a workload named test 
in order to produce results.

## Running the original server and the Karousos server 

First, make sure that the database is not running. 

To run the Karousos server and the baseline, run: 

```text
./runServer.sh app_name workload_name 
```

It searches for the workload in the `wokloads/$app_name/$workload_name.csv`
Optional parameters: 

- `-u, --unmodified`: run the unmodified server. If the flag is not specified, the Karousos server is executed,
- `--collect-orochi-js-advice`: collect advice for orochi-js and Karousos.
- `-i, --iterations`: i the number of iterations [default: 1]

## Running the Karousos verifier 

To run the verifier execute: 

```text
./runVerifier.sh app_name workload_name
```

Optional parameters:
- `-o, --orochi-js`: execute the verifier for Orochi-JS instead of Karousos.
- `-i, --iterations` the number of iterations [default: 1]. 

# Environment variables: 

1. `ADVICE_MODE`: Different values of `ADVICE_MODE` correspond to different 
parts of the advice collection procedure being turned off. 
Specifically: 
- `ADVICE_MODE=0`: full karousos server [default]
- `ADVICE_MODE=1`: full karousos server but turn off the saving the requests on disk 
- `ADVICE_MODE=2`: Same as `ADVICE_MODE=1` and additionally turn off 
logic for collecting advice for variable ops
- `ADVICE_MODE=3`: Same as `ADVICE_MODE=2` and additionally turn off 
logic for collecting the rest of the advice
- `ADVICE_MODE=4`: Same as `ADVICE_MODE=3` and additionally turn off 
logic for keeping track of object ids and handler ids
- `ADVICE_MODE=5`: Same as `ADVICE_MODE=4` and additionally turn off 
wrapping of functions (we need to recompile the server code in this case)
2. `ISOLATION_LEVEL`: This is used to control the ISOLATION LEVEL at the database. It may be 
0 for read uncommitted, 1 for read committed, or 3 for serializability
3. `KEEP_ALIVE_FOR`: Number of ms that the Karousos/original server execute for (then, we shut
them down) 
4. `IGNORE_REQS`: The default value is 0. 
This is used to control how many requests are used for warmup when we run 
the server or the verifier (and are, thus, ignored when collecting measurements).
5. `IN_ORDER`: Set this to true if you want the verifier to execute the requests one by one 
in the order that the server executes them (no batching). 

# Measurements
Any measurements from measurements are collected in 
`karousos/measurements/$app_name-$workload_name/$iteration_no` 
For the verifier, an extra file is created that maps the cft to the requestIDs in the group
Measurements are saved in csv files. Each csv file will have two columns. 
First column is what is measured and second row is the measurement.
