define(["persona", "js/onboarding", "jquery"], function(Persona, onboarding, $){

	var personaFn = {
		login: function(){
			Persona.get(function(assertion){
				if (assertion) {
					$.ajax("/auth/persona", {
						type: "post",
						data: {
							"assertion": assertion
						},
						statusCode: {
							204: function(){
								window.location.reload();
							},
							401: function(){
								console.log("Login failed");
							}
						}
					});
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
				window.location.href = "/auth/google";
			} else {
				personaFn.login();
			}
		},
		logout: function(google){
			personaFn.logout();
			onboarding.reset();
			window.location.href = "/logout";
		}
	};
});