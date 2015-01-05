define(["filesaver"], function(saveAs){
	// FileSaver does not support IE9.
	return function(blob, filename){
		if(!saveAs(blob, filename)){
			alert("File download is unfortunately not supported in your " +
			"browser.\n\nConsider taking a screenshot to save your plot " +
			"or manually copy/paste your script file into an editor.");
			return false;
		}
		return true;
	};
});
