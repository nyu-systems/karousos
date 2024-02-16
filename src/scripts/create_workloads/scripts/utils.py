import csv

def write_workloads(fname, fieldnames, workloads):
	with open(fname, mode = 'w') as csv_file:
		writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
		writer.writeheader()
		for item in workloads:
			writer.writerow(item)