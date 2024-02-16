#!/bin/bash

USAGE="Usage: $0 [#total requests] [#ignore] with optional flag --all to run all experiments."

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

if [ $# -ne 2 ]; then 
	echo "Incorrect number of arguments. $USAGE"
	exit
fi

inserts=10
for i in 1 10 20 30 60
do
	export KEEP_ALIVE_FOR_ORIG=120000
	export KEEP_ALIVE_FOR_SERVER=160000
	req_no=$(( $1 / $i ))
	export TOT_REQS=$req_no
	export IGNORE_REQS=$(( $2 / $i ))

	if $run_all_experiments; then	
		#Now create the mixed workload
		#../../create_workloads/create_workloads_probability.sh -a stackTrace -r $req_no -t $i -P 50 -L 50 -I $inserts
		workload="post-50_list-50_inserts-${inserts}_"$req_no"_$i"
		./run_workload.sh stackTrace $workload $2 
		sleep 10s
		#create the write heavy workload
		#../../create_workloads/create_workloads_probability.sh -a stackTrace -r $req_no -t $i -P 90 -L 10 -I $inserts
		 workload="post-90_list-10_inserts-${inserts}_"$req_no"_$i"
	 	./run_workload.sh stackTrace $workload $2
		sleep 10s
	fi
	
	#Now create the list heavy workload
	#../../create_workloads/create_workloads_probability.sh -a stackTrace -r $req_no -t $i -P 10 -L 90 -I 10

	workload="post-10_list-90_inserts-10_"$req_no"_$i"

	./run_workload.sh stackTrace $workload $2

	sleep 10s
done 


