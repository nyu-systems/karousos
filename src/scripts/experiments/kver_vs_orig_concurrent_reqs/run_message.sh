#!/bin/bash

USAGE="Usage: $0 [#total requests] with optional flag --all to run all experiments."

run_all_experiments=false;
while [ $# -gt 0 ]; do
  case $1 in
    -a | --all)
      run_all_experiments=true
      ;;
    *)
      break;
  esac
  shift
done

if [ $# -ne 1 ]; then 
	echo "Incorrect number of arguments. $USAGE"
	exit
fi

for i in 1 10 20 30 60
do
	export KEEP_ALIVE_FOR_ORIG=10000
	export KEEP_ALIVE_FOR_SERVER=15000
	req_no=$(( $1 / $i ))
	export TOT_REQS=$req_no
	if $run_all_experiments; then
		#Read-heavy workload
		#../../create_workloads/create_workloads_probability.sh -a message -r $req_no -t $i -P 10 -L 0 -v true 
		workload="post-10_list-0_"$req_no"_$i"
		./run_workload.sh message $workload
		sleep 10s

		#Mixed workload
		#../../create_workloads/create_workloads_probability.sh -a message -r $req_no -t $i -P 50 -L 0 -v true
		workload="post-50_list-0_"$req_no"_$i"
		./run_workload.sh message $workload
		sleep 10s
	fi
	
	#Write-heavy workload
	#../../create_workloads/create_workloads_probability.sh -a message -r $req_no -t $i -P 90 -L 0 -v true
	workload="post-90_list-0_"$req_no"_$i"
	./run_workload.sh message $workload
	sleep 10s
done
