define("ko-takeArray", ["knockout"], function(ko){
	return function(ObsClass, obsArr, objKey, dataArr, dataKey){
		var obsKeys = ko.utils.arrayMap(obsArr(), function(v){
			return v[objKey]();
		});
		var dataKeys = ko.utils.arrayMap(dataArr, function(v){
			return v[dataKey];
		});

		var intersection = [];
		var obsOnly = [];
		var dataOnly = [];

		ko.utils.arrayForEach(obsKeys, function(k, i1){
			var i2 = dataKeys.indexOf(k);
			if(i2 !== -1){
				// Found a Match
				intersection.push([obsArr()[i1], dataArr[i2]]);
			}else{
				// Item to Remove
				obsOnly.push(obsArr()[i1]);
			}
		});
		ko.utils.arrayForEach(dataKeys, function(k, i2){
			var i1 = obsKeys.indexOf(k);
			if(i1 === -1){
				// Item to Add
				dataOnly.push(dataArr[i2]);
			}
		});

		// Update the Matches
		ko.utils.arrayForEach(intersection, function(vv){
			var obs = vv[0], dat = vv[1];
			obs.take(dat);
		});

		// Remove expired values
		ko.utils.arrayForEach(obsOnly, function(obs){
			obsArr.remove(obs);
		});

		// Add new values
		ko.utils.arrayForEach(dataOnly, function(dat){
			var obs = new ObsClass();
			obs.take(dat);
			obsArr.push(obs);
		});
	}
})