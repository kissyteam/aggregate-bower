var fs = require('fs'),
	path = require('path'),
	depsOptimizer = require('deps-optimizer');

var requires = {};
var aliasContent = [];
var metaHead = ['modulex.use([\'ua\', \'feature\'], function(UA, Feature){','var mx = modulex;'].join('\n');
var metaFoot = '});';

function mkdirRecursion(dirPath,callback){
    if(fs.existsSync(dirPath)){   //如果已经存在
       callback && callback();
       return;
    }
    if(fs.existsSync(path.dirname(dirPath))){  //父目录是否存在
        fs.mkdir(dirPath,function(err,success){
            if(err){
                console.log(err);
            }else{
               callback && callback();
            }
        });
    }else{
        mkdirRecursion(path.dirname(dirPath),function(){
            fs.mkdir(dirPath,callback);
        });
    }
}

function endsWith(str, suffix) {
    var ind = str.length - suffix.length;
    return ind >= 0 && str.indexOf(suffix, ind) === ind;
}

function mix(r, s) {
    for (var i in s) {
        r[i] = s[i];
    }
}

function handleSubDir(subDir, dirToBeCreated){
	mkdirRecursion(dirToBeCreated);
	fs.readdirSync(subDir).forEach(function(file){
		var filePath = path.join(subDir, file);
		if(fs.statSync(filePath).isDirectory()){
			handleSubDir(filePath, path.join(dirToBeCreated, file));
		}else{
			handleFile(filePath, path.join(dirToBeCreated, file));
		}
	})
}

function handleFile(srcFile, desFilePath){
	if(endsWith(srcFile, 'deps.json')){
		var content = fs.readFileSync(srcFile);
		mix(requires, eval('(' + content + ')'));			
	}else if(endsWith(srcFile, '-debug.js') || endsWith(srcFile, '.js') && !endsWith(srcFile, '-deps.js')){
		fs.createReadStream(srcFile)
			.pipe(fs.createWriteStream(desFilePath));
	}
}

function isContainDebugFile(srcPath){
	if(!fs.existsSync(srcPath)){
		return false;
	}
	var isContain = false;
	var files = fs.readdirSync(srcPath);
	for(var i = 0; i < files.length; i++){
		var filePath = path.join(srcPath, files[i]);
		if(fs.statSync(filePath).isDirectory(filePath)){
			isContain = isContainDebugFile(filePath);
		}else{
			isContain = endsWith(filePath, '-debug.js');
		}
		if(isContain){
			break;
		}
	}
	return isContain;
}

function GenModulexComs(src, des){
	var src = src || 'bower_components/',
		des = des || 'modulex_modules/';
	if(!fs.existsSync(src)){
		return;
	}
	mkdirRecursion(des);   

	fs.readdirSync(src).forEach(function(moduleDirectory){
		var moduleBuildPath = path.join(src, moduleDirectory, 'build/');
		if(!fs.existsSync(moduleBuildPath) || !isContainDebugFile(moduleBuildPath)){  //如果build目录没有-debug.js文件，说明这个不是kissy的模块则不处理
			return false;
		}
		fs.readdirSync(moduleBuildPath).forEach(function(file){
			var filePath = path.join(moduleBuildPath, file);
			if( fs.statSync(filePath).isDirectory()){
				handleSubDir(filePath, path.join(des, file));
			}else{
				handleFile(filePath, path.join(des, file));
			}
		});

		var moduleMetaPath = path.join(src, moduleDirectory, 'meta/');
		if(fs.existsSync(moduleMetaPath)){
			fs.readdirSync(moduleMetaPath).forEach(function(metaFile){
				aliasContent.push(fs.readFileSync(path.join(moduleMetaPath, metaFile)).toString());
			})
		}
	});

	requires = depsOptimizer.optimize(requires);
	var metaCode = ['mx.config("requires",' + JSON.stringify(requires, undefined, 4) + ');'];
	metaCode = ['/*jshint indent:false, quotmark:false*/', metaHead].concat(metaCode).concat(aliasContent).concat(metaFoot).join('\n');
	fs.writeFileSync(path.join(des, 'meta.js'), metaCode);
}

module.exports = GenModulexComs;