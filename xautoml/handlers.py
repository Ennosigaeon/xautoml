def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    handlers = []
    web_app.add_handlers(host_pattern, handlers)
