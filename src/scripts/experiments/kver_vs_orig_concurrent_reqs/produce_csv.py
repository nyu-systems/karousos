import sys
import os
import csv
import argparse 
from os.path import exists

req_no = 600;
concurrent_reqs = [1, 10, 20, 30, 60];

measurements_path = "results";
measurements_advice_path = "results/advice-size";

benchmarks_msg = ["m", 'w', "r"]
benchmarks_wiki = ["m"]
benchmarks_stackTrace = ["m", "w", "r"]

fieldnames = ["Benchmark", "Original", "Original 5 percentile", "Original 95 Percentile", "Verifier", "Verifier 5 percentile", "Verifier 95 Percentile"]

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
    inserts = 10;
    mapping = {
        "message-r": "message-post-10_list-0_" + str(req_no//p) + "_" + str(p),
        "message-w": "message-post-90_list-0_" + str(req_no//p) + "_" + str(p),
        "message-m": "message-post-50_list-0_" + str(req_no//p) + "_" + str(p),
        "wiki-m": "wiki-mix" + str(p),
        "stackTrace-r": "stackTrace-post-10_list-90_inserts-" + str(inserts) + "_" + str(req_no//p) + "_" + str(p),
        "stackTrace-w": "stackTrace-post-90_list-10_inserts-" + str(inserts) + "_" + str(req_no//p) + "_" + str(p),
        "stackTrace-m": "stackTrace-post-50_list-50_inserts-" + str(inserts) + "_"  + str(req_no//p) + "_" + str(p),
    }
    return mapping.get(benchmark);

#Returns the median, the 5th and the 95th percentile
def get_median_with_err(fname, name):
    with open(fname, 'r') as input_file:
        reader = csv.reader(input_file)
        rows = list(reader);
        for row in rows:
            if row[0] == name:
                return [float(row[4])/1000, float(row[6])/1000, float(row[7])/1000, float(row[9])/1000, float(row[10])/1000, float(row[11])/1000];
        print("ERROR: Could not find " + name + " in " + fname)
        sys.exit(-1);

def get_measurement(fname, idx):
    with open(fname, 'r') as input_file:
        reader = csv.reader(input_file);
        rows = list(reader);
        return float(rows[idx][1])/pow(2,20)

def processDataForBenchmark(name, benchmark):
    res = []
    for p in concurrent_reqs:
        base_fname = benchmark_name_to_fname(name + "-" + benchmark, p) + ".csv";
        advice_size = get_measurement(os.path.join(measurements_path, base_fname), 1);
        advice_size_orochi = get_measurement(os.path.join(measurements_path, base_fname), 2);
        res.append([ p , advice_size, advice_size_orochi]);
    return res;

def processDataForBenchmark(name, benchmark):
    res_ver = [[
        "#Concurrent requests",
        "Baseline(s) [median]",
        "Baseline(s) [5th Percentile]",
        "Baseline(s) [95th Percentile]",
        "Karousos(s) [median]",
        "Karousos(s) [5th Percentile]",
        "Karousos(s) [95th Percentile]",
        "Orochi-JS(s) [median]",
        "Orochi-JS(s) [5th Percentile]",
        "Orochi-JS(s) [95th Percentile]",
    ]]
    res_advice = [
        [
        "#Concurrent requests",
        "Karousos Advice size (KB)",
        "Orochi-JS Advice size (KB)"
        ]        
    ]
    for p in concurrent_reqs:
        base_fname = benchmark_name_to_fname(name + "-" + benchmark, p) + ".csv";
        #Now get the data for the original server
        original = get_median_with_err(os.path.join(measurements_path, base_fname), "Original");
        #Now get the data for the karousos server
        kver = get_median_with_err(os.path.join(measurements_path, base_fname), "Verifier");
        kver_orochi = get_median_with_err(os.path.join(measurements_path, base_fname), "Orochi-JS");
        #Returns the data for individual ops in server execution and 5th percentile, 95th percentile for the other execution
        res_ver.append([ str(p), original[0], original[1], original[2], kver[0], kver[1], kver[2], kver_orochi[0], kver_orochi[1], kver_orochi[2]])
        advice_size = get_measurement(os.path.join(measurements_advice_path, base_fname), 1);
        advice_size_orochi = get_measurement(os.path.join(measurements_advice_path, base_fname), 2);
        res_advice.append([ p , advice_size, advice_size_orochi]);
    return [res_ver, res_advice];

def processData(benchmark, name, exp_folder):
        print(benchmark, name);
        out_ver = [];
        out_advice = [];
        [data_ver, data_advice] = processDataForBenchmark(name, benchmark);
        out_ver = [*out_ver, *data_ver]
        out_advice = [*out_advice, *data_advice]
        dirName_ver = "csv_files_ver"
        dirName_advice = "csv_files_advice"
        if not(os.path.exists(dirName_ver)):
            os.mkdir(dirName_ver);
        if not(os.path.exists(dirName_advice)):
            os.mkdir(dirName_advice);
        fpath_ver = dirName_ver + "/" + name + "_" + benchmark + ".csv";
        fpath_advice = dirName_advice + "/" + name + "_" + benchmark + ".csv";
        outputToCSV(fpath_ver, out_ver);
        outputToCSV(fpath_advice, out_advice);

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
