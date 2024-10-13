.PHONY : fe clean all

default:
	go run main.go

fe:
	cd frontend && pnpm build

dev:
	cd frontend && pnpm dev

gen:
ifeq (, $(shell which ogen))
		go install github.com/ogen-go/ogen/cmd/ogen@v1.4.1
endif
	go generate ./...

all: gen
	$(MAKE) fe && cd ..
	CGO_ENABLED=0 go build -o yt-dlp-webui main.go

multiarch:
	$(MAKE) fe
	mkdir -p build
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o build/yt-dlp-webui_linux-amd64 main.go
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o build/yt-dlp-webui_linux-arm64 main.go
	CGO_ENABLED=0 GOOS=linux GOARM=6 GOARCH=arm go build -o build/yt-dlp-webui_linux-armv6 main.go
	CGO_ENABLED=0 GOOS=linux GOARM=7 GOARCH=arm go build -o build/yt-dlp-webui_linux-armv7 main.go

clean:
	rm -rf build
