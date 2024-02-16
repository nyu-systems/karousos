
#!/bin/bash
USAGE="Usage: $0 applicationName. \n
	Compiles the application for the server and verifier\n"

if [ $# -ne 1 ]; then 
	echo "Incorrect number of arguments. $USAGE"
	exit -1
fi

app=$1

# Remove the compiled server and verifier 
rm -r apps/${app}-prover 
rm -r apps/${app}-verifier 

# First, compile the application for the server
./compile.sh $app

# Run the server twice to compile all required modules
./runServer.sh $app "test"
./runServer.sh $app "test"

# Now run the server again to create advice to execute the verifier
./runServer.sh $app "test"

# Now compile the application for the verifier
./compile.sh $app 1

# Run the verifier once to compile all required modules
./runVerifier.sh $app "test"
