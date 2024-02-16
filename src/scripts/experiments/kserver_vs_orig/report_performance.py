import sys
import os
import csv
import statistics
import numpy as numpy
from os.path import exists;

def get_total_time(fname, req_no, requests_to_ignore):
	res = 0.0;
	with open(fname, 'r') as csv_file:
		lines = csv_file.read().split("\n")[requests_to_ignore:];
		for line in lines:
			if line.endswith("\r"):
				line = line[:-1]
			if line == "":
				continue
			entries = line.split(",")
			#Check if the request id needs to be skipped:
			if len(entries) != 2:
				print("ERROR: Wrong number of entries in " + csv_file + " !")
				sys.exit(-1)
			res += float(entries[1]);
	return res;

def get_measurements_as_array(folder, req_no, requests_to_ignore):
	files = os.listdir(folder);
	total_times = [];
	if not("1" in files):
		fname = folder + "/active_time.csv";
		total = get_total_time(fname, req_no, int(requests_to_ignore));
		total_times.append(total);
	else:
		for f in files:
			fname = folder + "/" + f + "/active_time.csv";
			if exists(fname):
				total = get_total_time(fname, req_no, int(requests_to_ignore));
				total_times.append(total);
	return total_times;

def report_performance(folder, requests_to_ignore, out_f):
	requests_to_ignore = 0 #Set to 0
	exp_folders = ["original", "server"]
	if ("wiki-mix" in folder):
		req_no = 600
		concurrent_reqs = int(folder.split("x")[-1]);
	else:
		req_no = int(folder.split("_")[-2]);
		concurrent_reqs = int(folder.split("_")[-1]);
	fields = ["Type", "Min", "Max", "Mean", "Median", "1 Percentile", "5 Percentile", "95 Percentile", "99 Percentile"];
	with open(out_f, 'w') as o: 
		writer = csv.writer(o);
		writer.writerow(fields);
		for f in exp_folders:
			fname = folder + "/" + f;
			vals = get_measurements_as_array(fname, req_no, int(requests_to_ignore)//concurrent_reqs);
			a = numpy.array(vals);
			row = [f,  min(vals), max(vals),statistics.mean(vals), statistics.median(vals), numpy.percentile(a, 1), numpy.percentile(a, 5), 
			numpy.percentile(a,95), numpy.percentile(a, 99)];
			print(row);
			writer.writerow(row)
		
if __name__ == "__main__":	
	if (len(sys.argv)) < 3:
		print("ERROR: Need to supply at least 3 arguments!")
		print("Usage: " + sys.argv[0] + " [folder of experiments] [number of requests to ignore] [output file]")
		sys.exit()
	report_performance(sys.argv[1], sys.argv[2], sys.argv[3])
