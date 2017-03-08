HEADER = $(shell for file in `find . -name *.h | grep -v Pods`;do echo $$file; done)
C_SOURCE = $(shell for file in `find . -name *.c | grep -v Pods`;do echo $$file; done)
CPP_SOURCE = $(shell for file in `find . -name *.cpp | grep -v Pods`;do echo $$file; done)
OBJC_SOURCE = $(shell for file in `find . -name *.m | grep -v Pods`;do echo $$file; done)
SOURCES = $(HEADER) $(C_SOURCE) $(CPP_SOURCE) $(OBJC_SOURCE)

all:
	for SOURCE in $(SOURCES); do sh format.sh $$SOURCE; done

