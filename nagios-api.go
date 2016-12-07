package main

import (
	"encoding/json"
	"fmt"
	"github.com/efigence/go-nagios"
	"github.com/efigence/go-nagiosapi/config"
	"github.com/efigence/go-nagiosapi/src/webapi"
	"github.com/op/go-logging"
	"github.com/patrickdappollonio/goji-gzip"
	"github.com/pmylund/go-cache"
	"github.com/unrolled/render" // or "gopkg.in/unrolled/render.v1")
	"github.com/zenazn/goji"
	"github.com/zenazn/goji/web"
	"net/http"
	"os"
	"time"
)

var version string
var log = logging.MustGetLogger("main")
var stdout_log_format = logging.MustStringFormatter("%{color:bold}%{time:2006-01-02T15:04:05.9999Z-07:00}%{color:reset}%{color} [%{level:.1s}] %{color:reset}%{shortpkg}[%{longfunc}] %{message}")

func main() {
	stderrBackend := logging.NewLogBackend(os.Stderr, "", 0)
	stderrFormatter := logging.NewBackendFormatter(stderrBackend, stdout_log_format)
	logging.SetBackend(stderrFormatter)
	logging.SetFormatter(stdout_log_format)

	log.Info("Starting app")
	log.Debug("version: %s", version)
	log.Info("Starting web server on 8000")
	r := render.New(render.Options{
		IndentJSON: true,
	})
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Errorf("Config error: %+v", err)
		os.Exit(1)
	}
	if len(os.Args) >= 2 {
		cfg.NagiosStatusFile = os.Args[1]
	}
	if cfg.StatusUpdateInterval == 0 {
		cfg.StatusUpdateInterval = 30 * 1001
	}
	log.Warningf("FF: %+v", cfg)
	serializerCache := cache.New(30*time.Second, 5*time.Minute)
	file, _ := os.Open(cfg.NagiosStatusFile)
	st, err := nagios.LoadStatus(file)
	fmt.Printf("parse err: %+v\n", err)
	file.Close()

	// set and run update timer
	updateTimer := time.NewTicker(time.Duration(cfg.StatusUpdateInterval) * time.Millisecond)
	go func() {
		for _ = range updateTimer.C {
			log.Info("updating from file")
			file, _ := os.Open(cfg.NagiosStatusFile)
			st.UpdateStatus(file)
			serializerCache.Delete("nagios-all")
			file.Close()
		}
	}()

	httpCfg := cfg.Endpoints.Http
	app := webapi.NewWebapp()
	app.NagiosStatus = st
	goji.Use(gzip.Compress)
	goji.Get("/s/*", http.StripPrefix("/s", http.FileServer(http.Dir(httpCfg.StaticDir))))
	goji.Get("/", http.FileServer(http.Dir(httpCfg.StaticDir)))
	goji.Get("/index.html", http.FileServer(http.Dir(httpCfg.StaticDir)))
	goji.Get("/favico.ico", http.FileServer(http.Dir(httpCfg.StaticDir+"/img")))

	goji.Get("/v1/all", func(c web.C, w http.ResponseWriter, req *http.Request) {
		w.Header().Set(render.ContentType, "application/json")
		all, found := serializerCache.Get("nagios-all")
		if !found {
			jsOut, _ := json.Marshal(st)
			r.Data(w, http.StatusOK, jsOut) // map[string]string{"welcome": "This is rendered JSON!"})
			serializerCache.Set("nagios-all", jsOut, cache.DefaultExpiration)
		} else {
			jsOut := all.([]byte)
			r.Data(w, http.StatusOK, jsOut) // map[string]string{"welcome": "This is rendered JSON!"})
		}

	})
	goji.Get("/v1/host/:host", func(c web.C, w http.ResponseWriter, req *http.Request) {
		app.NagiosHost(c, w, req, st)
	})
	goji.Get("/v1/service/:host", func(c web.C, w http.ResponseWriter, req *http.Request) {
		app.NagiosHostServices(c, w, req, st)
	})
	goji.Get("/v1/service/:host/:service", func(c web.C, w http.ResponseWriter, req *http.Request) {
		app.NagiosService(c, w, req, st)
	})
	goji.Get("/v1/update", func(c web.C, w http.ResponseWriter, req *http.Request) {
		file, _ := os.Open(cfg.NagiosStatusFile)
		st.UpdateStatus(file)
		file.Close()
	})
	goji.Serve() // Defaults to ":8000".
	_ = r
}
