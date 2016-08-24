package config

import (
	"github.com/XANi/go-yamlcfg"
	"github.com/op/go-logging"
	"os"
)

var log = logging.MustGetLogger("main")

type Config struct {
	NodeName string `yaml:"node_name"`
	StatusUpdateInterval int `yaml:"status_update_interval"`
	NagiosStatusFile string `yaml:"status_file"`
	Endpoints Endpoints `yaml:"endpoints"`
}

func (c *Config) SetConfigPath(filename string) {
	log.Infof("Loaded config from %s", filename)
}

type Endpoints struct {
	Zerosvc ZerosvcConfig `yaml:"zerosvc,omitempty"`
	Http HttpConfig `yaml:"http,omitempty"`
}
type ZerosvcConfig struct {
	Enabled bool `yaml:"enabled"`
	Endpoint string `yaml:"endpoint"`
	NodeName string `yaml:"node_name"`
	NodeUUID string `yaml:"node_uuid"`
	ServiceName string `yaml:"service_name"`
}
type HttpConfig struct {
	Enabled bool `yaml:"enabled"`
	ListenAddr string `yaml:"listen_addr"`
	StaticDir string `yaml:"static_dir"`
}

var cfgFiles =[]string{
    "./cfg/config.yaml",
    "/etc/nagiosapi/config.yaml",
	"./cfg/config.default.yaml",
}


func LoadConfig() (c *Config, err error) {
	var cfg Config
	// Defaults
	cfg.NodeName, _ = os.Hostname()
	cfg.StatusUpdateInterval = 30 * 1000
	cfg.NagiosStatusFile = `t-data/status.dat.local`
	cfg.Endpoints.Http.Enabled = true
	cfg.Endpoints.Http.StaticDir = `./public`
	cfg.Endpoints.Http.ListenAddr = `127.0.0.1:8000`
	err = yamlcfg.LoadConfig(cfgFiles, &cfg)
	return &cfg, err
}
