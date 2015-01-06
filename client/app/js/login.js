define(["persona", "js/onboarding"], function(Persona, onboarding){

	var personaFn = {
		login: function(){
			Persona.get(function(assertion){
				if (assertion) {
					var form = $("<form>");
					form.attr("action", "auth/persona");
					form.attr("method", "post");
					var input = $("<input>");
					input.attr("name", "assertion");
					input.attr("value", assertion);
					form.append(input);
					form.submit();
				}
			}, {
				siteName: "Octave Online",
				siteLogo: "https://static.e-junkie.com/sslpic/138075.31d67f7c369b81df82106d9c6c9bd2a6.gif"
			});
		}, logout: function(){
			Persona.logout();
		}
	};

	return {
		login: function(google){
			if (google) {
				window.location.href = "auth/google";
			} else {
				personaFn.login();
			}
		},
		logout: function(google){
			personaFn.logout();
			onboarding.reset();
			window.location.href = "logout";
		}
	};
});