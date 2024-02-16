# Generators for wokrloads 

Examples can be found in the bash scripts.

Shared options:
- `-a`: application
- `-r`: request number per thread -- default=10
- `-r`: 
1. number: You can specify the same request number for all the threads.
2. number1, number2, ..., numberT:
You can also specify a different request number for each threads.
- `-t`: thread number -- default=3
- `-v`: visibility, if empty then assigned randomly (not for stackTrace)

For `create_workloads.sh`:
- `-m`: sequence of request types per thread-- default="post-get". 
Can be: 
1. type1-type2,type1-type2-type3,type1: 
you specify the request type sequence for all the threads.
2. type1-type2,type1-type2-type3,type1,...,sequenceT: 
you also specify a different request type sequence for each threads.
- `-o`: workload name. Default is: `[request type sequence]_[request numbers]_[thread_number]/`

For `create_workloads_probability.sh` 
- `-P`: probability of post requests. Default is 50
- '-L': probability of a get request being a list request
- `-U`: probability of a post request being an update request (For inventory)
- `-I`: probability of a post request being an insert request (For stack trace)
- `-o`: workload name. Check file for the default name per application 
