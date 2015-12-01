#!/bin/bash

adb uninstall br.com.join
phonegap build android
phonegap run android