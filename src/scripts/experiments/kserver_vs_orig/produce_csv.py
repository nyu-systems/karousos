import sys
import os
import csv
import argparse 

to_list=20;
req_no = 600;

measurements_path = "results"; 
#Change total number of requests (req_no) accordingly
def readData(fpath):
	mean_and_err = []
	with open(fpath, 'r') as input_file:
		reader = csv.reader(input_file)
		for row in reader:
			for i in range(len(row)):
				row[i] = float(row[i])
			mean_and_err.append(row)
	return mean_and_err[0]

def benchmark_name_to_fname(benchmark, p):
    mapping = {
        "message-r": "message-post-10_list-0_" + str(req_no//p) + "_" + str(p), 
        "message-w": "message-post-90_list-0_" + str(req_no//p) + "_" + str(p), 
        "message-m": "message-post-50_list-0_" + str(req_no//p) + "_" + str(p), 
        "wiki-m": "wiki-mix" + str(p), 
        "inventory-w": "inventory-post-90_update-50_" + str(req_no//p) + "_" + str(p), 
        "inventory-m": "inventory-post-50_update-50_" + str(req_no//p) + "_" + str(p), 
    	"stackTrace-r": "stackTrace-post-10_list-90_inserts-10_" + str(req_no//p) + "_" + str(p), 
        "stackTrace-w": "stackTrace-post-90_list-10_inserts-10_" + str(req_no//p) + "_" + str(p), 
        "stackTrace-m": "stackTrace-post-50_list-50_inserts-10_" + str(req_no//p) + "_" + str(p), 
    }
    return mapping.get(benchmark);

#Returns the median, the 5th and the 95th percentile
def get_median_with_err(fname, name, app_name):
    with open(fname, 'r') as input_file:
        reader = csv.reader(input_file)
        rows = list(reader);
        for row in rows:
            if row[0] == name:
                return [float(row[4])/1000, float(row[6])/1000, float(row[7])/1000];
        print("ERROR: Could not find " + name + " in " + fname)
        sys.exit(-1);
            

def processDataForBenchmark(name, benchmark):
    res = [[
        "Concurrent requests", 
        "Baseline(s) [median]",
        "Baseline(s) [5th Percentile]",
        "Baseline(s) [95th Percentile]",
        "Karousos(s) [median]",
        "Karousos(s) [5th Percentile]",
        "Karousos(s) [95th Percentile]",
    ]]
    for i in [1, 10, 20, 30, 60]:
        base_fname = benchmark_name_to_fname(name + "-" + benchmark, i) + ".csv";
	#Now get the data for the original server
        original = get_median_with_err(os.path.join(measurements_path, base_fname), "original", name);
        #Now get the data for the karousos server
        kserver = get_median_with_err(os.path.join(measurements_path, base_fname), "server", name);
        res.append([ str(i), original[0], original[1], original[2], kserver[0], kserver[1], kserver[2]]);
    return res;

def processData(benchmark, name, exp_folder):
    out = [];
    data = processDataForBenchmark(name, benchmark);
    out = [*out, *data]
    dirName = "csv_files";
    if not(os.path.exists(dirName)):
    	os.mkdir(dirName);
    fpath = dirName + "/" + name + "_" + benchmark + ".csv";
    outputToCSV(fpath, out);

def outputToCSV(fpath, data):
    with open(fpath, 'w') as csvfile:
        writer = csv.writer(csvfile)
        for row in data:
            writer.writerow(row)

if __name__ == "__main__":
	parser = argparse.ArgumentParser(
                    prog='Produce csv files',
                    description='Produce csv files from measurements in results/')
	parser.add_argument('-a', '--all',  dest='all', action='store_const', const=True, default=False) 
	args = parser.parse_args()

	curr_dir = os.getcwd()
	processData("m", "wiki", curr_dir);
	processData("r", "stackTrace", curr_dir);
	processData("w", "message", curr_dir);
	if args.all:
		processData("m", "stackTrace", curr_dir);
		processData("w", "stackTrace", curr_dir);
		processData("r", "message", curr_dir);
		processData("m", "message", curr_dir);
