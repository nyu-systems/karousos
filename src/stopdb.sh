#!/bin/bash
source env.sh
source $KAR_HOME/src/env-measurements.sh
cd "$DST_CODE"
function stop_db_server {
	if [ ! $IS_PROVER ]; then
		#This is a good opportunity to clear the database
		$mysql -u root -p"1234" -D "test" -e "DELETE FROM stackTrace" 	
		$mysql -u root -p"1234" -D "test" -e "DELETE FROM inventory" 	
	fi	
	# Stop the service
	$mysqladmin -uroot -p"1234" shutdown
}
stop_db_server
