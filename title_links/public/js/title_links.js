const formatLinks = () => {
	frappe.ui.form.ControlLink = frappe.ui.form.ControlLink.extend({
		make_input: function () {
			var me = this;
			// line-height: 1 is for Mozilla 51, shows extra padding otherwise
			$('<div class="link-field ui-front" style="position: relative; line-height: 1;">\
				<input type="text" class="input-with-feedback form-control">\
				<span class="link-btn">\
					<a class="btn-open no-decoration" title="' + __("Open Link") + '">\
						<i class="octicon octicon-arrow-right"></i></a>\
				</span>\
			</div>')
				.prependTo(this.input_area);
			this.$input_area = $(this.input_area);
			this.$input = this.$input_area.find('input');
			this.$link = this.$input_area.find('.link-btn');
			this.$link_open = this.$link.find('.btn-open');
			this.set_input_attributes();
			this.$input.on("focus", function () {
				setTimeout(function () {
					if (me.$input.val() && me.get_options()) {
						me.$link.toggle(true);
						me.$link_open.attr('href', '#Form/' + me.get_options() + '/' + me.get_value());
					}
	
					if (!me.$input.val()) {
						me.$input.val("").trigger("input");
					}
				}, 500);
			});
			this.$input.on("blur", function () {
				// if this disappears immediately, the user's click
				// does not register, hence timeout
				setTimeout(function () {
					me.$link.toggle(false);
				}, 500);
			});
			this.input = this.$input.get(0);
			this.has_input = true;
			this.translate_values = true;
			var me = this;
			this.setup_buttons();
			this.setup_awesomeplete();
			if (this.df.change) {
				this.$input.on("change", function () {
					me.df.change.apply(this);
				});
			}
		},
	
		format_for_input: function (value) {
			var me = this,
				su = this._super,
				ret
	
			if (value) {
				frappe.call({
					'async': false,
					'method': 'title_links.routes.search_title',
					'args': {
						doctype: me.df.options,
						name: value
					},
					callback: function (res) {
						if (!res.exc) {
							ret = res.message[1];
						}
					}
				});
			} else if (me.value) {
				ret = me.value;
			} else {
				ret = su(value)
			}
			return ret;
		},
	
		set_input: function (value) {
			this.last_value = this.value;
			this.value = value;
			if (this.$input) {
				if ((this.frm && this.frm.doc) || cur_page.page.id.toLowerCase().indexOf("report") !== -1 ) {
					this.$input.val(this.format_for_input(value));
				} else {
					this.$input.val(value);
				}
				this.$input.data("value", value);
			}
			this.set_disp_area();
			this.set_mandatory && this.set_mandatory(value);
		},
	
		get_value: function () {
			return this.$input ? this.$input.data("value") : undefined;
		},
	
		setup_awesomeplete: function () {
			var me = this;
			this.$input.on("blur", function () {
				if (me.selected) {
					me.selected = false;
					return;
				}
				var value = me.get_value();
				if (me.doctype && me.docname) {
					if (value !== me.last_value) {
						me.parse_validate_and_set_in_model(value);
					}
				} else {
					me.set_mandatory(value);
				}
			});
	
			this.$input.cache = {};
	
			this.awesomplete = new Awesomplete(me.input, {
				minChars: 0,
				maxItems: 99,
				autoFirst: true,
				list: [],
	
				data: function (item, input) {
					return {
						label: item.label || item.value,
						value: item.value
					};
				},
	
				filter: function (item, input) {
					var d = this.get_item(item.value);
					return Awesomplete.FILTER_CONTAINS(d.value, '__link_option') ||
						Awesomplete.FILTER_CONTAINS(d.value, input) ||
						Awesomplete.FILTER_CONTAINS(d.description, input);
				},
	
				item: function (item, input) {
					var d = this.get_item(item.value);
					if (!d.label) {
						if (this.frm && this.frm.doc || cur_page.page.id.toLowerCase().indexOf("report") !== -1) {
							d.label = me.format_for_input(d.value) || d.value;
						} else {
							d.label = d.value;
						}
					}
					var _label = (me.translate_values) ? __(d.label) : d.label;
					var html = "<strong>" + _label + "</strong>";
	
					if (d.description && d.label !== d.description) {
						html += '<br><span class="small">' + __(d.description) + '</span>';
					}
					return $('<li></li>')
						.data('item.autocomplete', d)
						.prop('aria-selected', 'false')
						.html('<a><p>' + html + '</p></a>')
						.get(0);
				},
				sort: function (a, b) {
					return 0;
				}
			});
	
			this.$input.on("input", function (e) {
				var doctype = me.get_options();
	
				if (!doctype) return;
				/*
				if (doctype.toLowerCase().indexOf("select") !== -1) {
					doctype = cur_page.page.page.fields_dict.doctype.$input.val();
				}
				*/
				if (!me.$input.cache[doctype]) {
					me.$input.cache[doctype] = {};
				}
	
				var term = e.target.value;
	
				if (me.$input.cache[doctype][term] != null) {
					// immediately show from cache
					me.awesomplete.list = me.$input.cache[doctype][term];
				}
	
				var args = {
					'txt': term,
					'doctype': doctype,
				};
	
				me.set_custom_query(args);
	
				frappe.call({
					type: "GET",
					method: 'title_links.routes.search_link',
					no_spinner: true,
					args: args,
					callback: function (r) {
						if (!me.$input.is(":focus")) {
							return;
						}
						if (!me.df.only_select) {
							if (frappe.model.can_create(doctype) &&
								me.df.fieldtype !== "Dynamic Link") {
								// new item
								r.results.push({
									label: "<span class='text-primary link-option'>" +
										"<i class='fa fa-plus' style='margin-right: 5px;'></i> " +
										__("Create a new {0}", [__(me.df.options)]) +
										"</span>",
									value: "create_new__link_option",
									action: me.new_doc
								})
							};
							// advanced search
							r.results.push({
								label: "<span class='text-primary link-option'>" +
									"<i class='fa fa-search' style='margin-right: 5px;'></i> " +
									__("Advanced Search") +
									"</span>",
								value: "advanced_search__link_option",
								action: me.open_advanced_search
							})
						}
						me.$input.cache[doctype][term] = r.results;
						me.awesomplete.list = me.$input.cache[doctype][term];
					}
				});
				if (!me.$input.val()) {
					me.set_input(null);
				}
			});
	
			this.$input.on("awesomplete-open", function (e) {
				me.$wrapper.css({ "z-index": 1001 });
				me.autocomplete_open = true;
			});
	
			this.$input.on("awesomplete-close", function (e) {
				me.$wrapper.css({ "z-index": 1 });
				me.autocomplete_open = false;
			});
	
			this.$input.on("awesomplete-select", function (e) {
				var o = e.originalEvent;
				var item = me.awesomplete.get_item(o.text.value);
	
				me.autocomplete_open = false;
	
				// prevent selection on tab
				var TABKEY = 9;
				if (e.keyCode === TABKEY) {
					e.preventDefault();
					me.awesomplete.close();
					return false;
				}
	
				if (item.action) {
					item.value = "";
					item.action.apply(me);
				}
	
				// if remember_last_selected is checked in the doctype against the field,
				// then add this value
				// to defaults so you do not need to set it again
				// unless it is changed.
				if (me.df.remember_last_selected_value) {
					frappe.boot.user.last_selected_values[me.df.options] = item.value;
				}
	
				if (me.frm && me.frm.doc) {
					me.selected = true;
					me.parse_validate_and_set_in_model(item.value);
					setTimeout(function () {
						me.selected = false;
					}, 100);
	
				} else if (cur_page.page.id.toLowerCase().indexOf("report") !== -1) {
					me.set_input(item.value);
					me.$input.trigger("change");
					setTimeout(function () {
							me.set_input(item.value);
					}, 100);
					me.set_mandatory(item.value);
	
				} else {
					me.set_input(item.value);
					me.$input.trigger("change");
					me.set_mandatory(item.value);
				}
			});
	
			this.$input.on("awesomplete-selectcomplete", function (e) {
				if (e.originalEvent.text.value.indexOf("__link_option") !== -1) {
					me.$input.val("");
				}
			});
		},
	});
	
	
	frappe.form.formatters.Link = function (value, docfield, options, doc) {
		var doctype = docfield._options || docfield.options,
			title;
		var original_value = value;
	
		if (value) {
			frappe.call({
				'async': false,
				'method': 'title_links.routes.search_title',
				'args': {
					doctype: doctype,
					name: value
				},
				callback: function (res) {
					if (!res.exc) {
						title = res.message[1];
					}
				}
			});
		}
	
		if (value && value.match(/^['"].*['"]$/)) {
			value.replace(/^.(.*).$/, "$1");
		}
	
		if (options && options.for_print) {
			return value;
		}
	
		if (frappe.form.link_formatters[doctype]) {
			value = frappe.form.link_formatters[doctype](value, doc);
		}
	
		if (!value) {
			return "";
		}
	
		if (value[0] == "'" && value[value.length - 1] == "'") {
			return value.substring(1, value.length - 1);
		}
	
		if (docfield && docfield.link_onclick) {
			return repl('<a onclick="%(onclick)s">%(value)s</a>', { onclick: docfield.link_onclick.replace(/"/g, '&quot;'), title: title });
	
		} else if (docfield && doctype) {
			return repl('<a class="grey" href="#Form/%(doctype)s/%(name)s" data-doctype="%(doctype)s">%(label)s</a>', {
				doctype: encodeURIComponent(doctype),
				name: encodeURIComponent(original_value),
				label: __(options && options.label || title || original_value)
			});
	
		} else {
			title || value;
		}
	}
	
	/*
	frappe.form.formatters.Link = function (value, docfield, options) {
		var doctype = docfield._options || docfield.options,
			title;
	
		if (value) {
			frappe.call({
				'async': false,
				'method': 'title_links.routes.search_title',
				'args': {
					doctype: doctype,
					name: value
				},
				callback: function (res) {
					if (!res.exc) {
						title = res.message[1];
					}
				}
			});
		}
		if (value && value.match(/^['"].*['"]$/)) {
			return value.replace(/^.(.*).$/, "$1");
		}
		if (options && options.for_print) {
			return title || value;
		}
		if (!value) {
			return "";
		}
		if (docfield && docfield.link_onclick) {
			return repl('<a onclick="%(onclick)s">%(title)s</a>', { onclick: docfield.link_onclick.replace(/"/g, '&quot;'), title: title });
		} else if (docfield && doctype) {
			return repl('<a class="grey" href="#Form/%(doctype)s/%(name)s" data-doctype="%(doctype)s">%(label)s</a>', {
				doctype: encodeURIComponent(doctype),
				name: encodeURIComponent(value),
				label: __(options && options.label || title || value)
			});
		} else {
			return title || value;
		}
	};
	*/
	/*
	frappe.ui.form.GridRow = frappe.ui.form.GridRow.extend({
		make_column: function (df, colsize, txt, ci) {
			var me = this;
			if (this.doc && this.doc.doctype !== cur_frm.doctype && me.doc[df.fieldname] && df.fieldtype.indexOf("Link") !== -1) {
				frappe.call({
					'async': false,
					'method': 'title_links.routes.search_title',
					'args': {
						doctype: (df.fieldtype === "Link") ? df.options : me.doc[df.options],
						name: me.doc[df.fieldname]
					},
					callback: function (res) {
						if (!res.exc) {
							txt = res.message[1];
						}
					}
				});
			}
			return this._super(df, colsize, txt, ci);
		}
	});
	*/
	
	if (frappe.views.ListRenderer) {
		frappe.views.ListRenderer = frappe.views.ListRenderer.extend({
			// returns html for a data item,
			// usually based on a template
			get_item_html: function (data) {
				var main = this.columns.map(column =>
						frappe.render_template('list_item_main', {
							data: data,
							col: column,
							value: data[column.fieldname],
							formatters: this.settings.formatters,
							subject: this.get_subject_html(data, true),
							indicator: this.get_indicator_html(data),
						})
					)
					.join("");
		
				return frappe.render_template('list_item_row', {
					data: data,
					main: main,
					settings: this.settings,
					meta: this.meta,
					indicator_dot: this.get_indicator_dot(data),
				})
			},
		
			get_subject_html: function (data, without_workflow) {
				data._without_workflow = without_workflow;
				return frappe.render_template('list_item_subject', data);
			},
		
			get_indicator_html: function (doc) {
				var indicator = frappe.get_indicator(doc, this.doctype);
				if (indicator) {
					return `<span class='indicator ${indicator[1]} filterable'
						data-filter='${indicator[2]}'>
						${__(indicator[0])}
					<span>`;
				}
				return '';
			}
		})
	}
};

const checkRoute = () => {
	let routeFound = false;
	const currentRoute = frappe.get_route(); // returns array ex: ["Form", "Address", "New Address 1"]

	doctypeWithLinkFieldsToFormat.forEach(doctype => {
		if (currentRoute[0] === "Form" && currentRoute[1] === doctype.name) {
			routeFound = true;
		}
	});

	return routeFound;
};

let doctypeWithLinkFieldsToFormat = [];
let isLinksHasBeenFormated = false;

$(document).ready(() => {
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			'doctype': 'Title Link Fields Formatter Setup',
			'fieldname': ['doctype_name']
		},
		callback: function(response) {
			if (!response.exc) {
				doctypeWithLinkFieldsToFormat = response.message;
				if (!isLinksHasBeenFormated && checkRoute()) {
					isLinksHasBeenFormated = true;
					formatLinks();
				}
			}
		}
	});
});

const addPageMessage = (title, content) => {
	const mainSection = document.getElementsByClassName("main-section")[0];
	let blocker = document.createElement("div");
	blocker.style.background = "#000000d4";
	blocker.style.width = "100%";
	blocker.style.height = "100vh";
	blocker.style.position = "absolute";
	blocker.style.zIndex = 999;

	let msgBox = document.createElement("div");
	msgBox.style.background = "#fff";
	msgBox.style.width = "300px";
	msgBox.style.height = "100px";
	msgBox.style.position = "absolute";
	msgBox.style.top = "calc(50% - 100px)";
	msgBox.style.left = "calc(50% - 150px)"
	msgBox.style.zIndex = 1000;

	let msgTitle = document.createElement("h3");
	msgTitle.innerHTML = title;
	msgTitle.style.margin = "10px";
	msgTitle.style.marginBottom = 0;

	const line = document.createElement("hr");
	line.style.marginTop = 0;

	let msgContent = document.createElement("p");
	msgContent.innerHTML = content;
	msgContent.style.margin = "10px";
	msgContent.style.marginTop = 0;

	msgBox.appendChild(msgTitle);
	msgBox.appendChild(line);
	msgBox.appendChild(msgContent);

	blocker.appendChild(msgBox);
	mainSection.parentNode.insertBefore(blocker, mainSection);
	window.onscroll = () => { window.scrollTo(0, 0); };
	document.body.scrollTop = document.documentElement.scrollTop = 0;
}

frappe.route.on('change', () => {
	if ((isLinksHasBeenFormated && !checkRoute()) || (!isLinksHasBeenFormated && checkRoute())) {
		addPageMessage("Please wait", "Page reloading");
		location.reload();
	}
});

frappe.ui.form.on('Title Link Fields Formatter Setup', {
	after_save(frm) {
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				'doctype': 'Title Link Fields Formatter Setup',
				'fieldname': ['doctype_name']
			},
			callback: function(response) {
				if (!response.exc) {
					doctypeWithLinkFieldsToFormat = response.message;
				}
			}
		});
	},
	on_trash(frm) {
		addPageMessage("Please wait", "Page reloading");
		location.reload();
	}
});
