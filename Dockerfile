#------------------------------------------------------------------------------------------#
#---------------------------------Container with Karousos deps-----------------------------#
#------------------------------------------------------------------------------------------#
FROM ubuntu:18.04 as karousos-deps

#----------------------Create a user id and group id in the container----------------------#

ARG USER_ID
ARG GROUP_ID

#Delete the previous group and user
RUN if [ ${USER_ID:-0} -ne 0 ] && [ ${GROUP_ID:-0} -ne 0 ]; then \
	if id -u "karousos" > /dev/null 2>&1; then userdel -f karousos; fi  &&\
	if getent group karousos; then groupdel karousos; fi &&\
	# Create the Karousos group and user with the input user id and group id
	groupadd -g ${GROUP_ID} karousos &&\
	useradd -rm -d /home/karousos -s /bin/bash -g karousos -G sudo -u ${USER_ID} karousos \
;fi

#-----------------------------------General Dependencies-----------------------------------#

RUN apt-get update && apt-get install -y \
	cmake \
	build-essential \
	wget \
	libncurses5-dev \
	libssl-dev \
	pkg-config \
	git \
	unzip \
	luajit \
	rsync \
	curl \
	python3-pip && \
	pip3 install numpy

RUN git clone https://github.com/wg/wrk.git wrk && \
	cd wrk && \
	make && \
	mv wrk /usr/local/bin && \
	cd .. && \
	rm -r wrk
		 
#--------------------------------------Setup Node.js---------------------------------------#

# The desired version is 12.16.1
WORKDIR /
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash - && \
    apt-get install -y nodejs && \ 
    npm install -g n && \
    n 12.16.1


#--------------------------------------Setup MySql-----------------------------------------#

# Preconfiguration setup 
RUN groupadd mysql
RUN useradd -r -g mysql -s /bin/false mysql

USER karousos
# Download mysql 8.0.19
WORKDIR /home/karousos
RUN wget https://downloads.mysql.com/archives/get/p/23/file/mysql-boost-8.0.19.tar.gz
RUN tar xzvf mysql-boost-8.0.19.tar.gz 
RUN rm mysql-boost-8.0.19.tar.gz

# Overwrite the mysql files for karousos
# TODO: Change these to wget when the karousos repo becomes public
COPY ./src/mysql_binlog/mysql-8-modified/client/* mysql-8.0.19/client/
COPY ./src/mysql_binlog/mysql-8-modified/sql/* mysql-8.0.19/sql/

# Now build and install
RUN cd mysql-8.0.19 &&\
	mkdir bld &&\
	cd bld &&\
	cmake .. -DWITH_BOOST=../boost && \
	make -j4 && \
	make install DESTDIR=/home/karousos/mysql/

# Post-installation setup
RUN cd mysql/usr/local/mysql &&\
	mkdir mysql-files && \
	bin/mysqld --initialize-insecure --user=mysql && \
	# Set the mysql root password to default 1234, 
	# create the test database, and the tables we use in Karousos
	nohup bash -c "bin/mysqld --user=mysql &" && \ 
	sleep 4 && \
	echo "CREATE DATABASE test;" | bin/mysql -u root && \
	echo "CREATE DATABASE wiki;" | bin/mysql -u root && \
	echo "USE test; \
		create table inventory ( \
			id_type varchar(255), \ 
			quantity int, \
			updateTime DATETIME, \ 
			visible tinyint(1), \
			ionRequestID longtext, \
			ionTxID longtext, \
			ionTxNum int, \
			primary key (id_type) \
		);" | bin/mysql -u root && \
	echo "USE test; \
		create table stackTrace ( \
			id_hash varchar(255), \ 
			trace longtext, \
			frequency int, \
			ionRequestID longtext, \
			ionTxID longtext, \
			ionTxNum int, \
			primary key (id_hash) \
		);" | bin/mysql -u root && \
	echo "ALTER USER 'root'@'localhost' IDENTIFIED BY '1234';" | bin/mysql -u root &&\
	bin/mysqladmin -u root -p"1234" shutdown

#-------------------------------Setup Environment variables--------------------------------#

ENV MYSQL_INSTALL_LOC=/home/karousos/mysql/usr/local/mysql

#------------------------------------------------------------------------------------------#
#----------------------------------Container for development-------------------------------#
#------------------------------------------------------------------------------------------#

FROM karousos-deps as karousos-dev

USER root
RUN apt-get install -y vim
