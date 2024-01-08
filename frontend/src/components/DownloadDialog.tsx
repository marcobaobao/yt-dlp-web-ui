import { FileUpload } from '@mui/icons-material'
import CloseIcon from '@mui/icons-material/Close'
import {
  Autocomplete,
  Backdrop,
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  TextField
} from '@mui/material'
import AppBar from '@mui/material/AppBar'
import Dialog from '@mui/material/Dialog'
import Slide from '@mui/material/Slide'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { TransitionProps } from '@mui/material/transitions'
import {
  FC,
  Suspense,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { customArgsState, downloadTemplateState, filenameTemplateState, savedTemplatesState } from '../atoms/downloadTemplate'
import { latestCliArgumentsState, settingsState } from '../atoms/settings'
import { availableDownloadPathsState, connectedState } from '../atoms/status'
import FormatsGrid from '../components/FormatsGrid'
import { useI18n } from '../hooks/useI18n'
import { useRPC } from '../hooks/useRPC'
import { CliArguments } from '../lib/argsParser'
import type { DLMetadata } from '../types'
import { isValidURL, toFormatArgs } from '../utils'
import ExtraDownloadOptions from './ExtraDownloadOptions'

const Transition = forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />
})

type Props = {
  open: boolean
  onClose: () => void
  onDownloadStart: (url: string) => void
}

const DownloadDialog: FC<Props> = ({ open, onClose, onDownloadStart }) => {
  const settings = useRecoilValue(settingsState)
  const isConnected = useRecoilValue(connectedState)
  const availableDownloadPaths = useRecoilValue(availableDownloadPathsState)
  const downloadTemplate = useRecoilValue(downloadTemplateState)
  const savedTemplates = useRecoilValue(savedTemplatesState)

  const [downloadFormats, setDownloadFormats] = useState<DLMetadata>()
  const [pickedVideoFormat, setPickedVideoFormat] = useState('')
  const [pickedAudioFormat, setPickedAudioFormat] = useState('')
  const [pickedBestFormat, setPickedBestFormat] = useState('')

  const [customArgs, setCustomArgs] = useRecoilState(customArgsState)
  const [, setCliArgs] = useRecoilState(latestCliArgumentsState)

  const [downloadPath, setDownloadPath] = useState('')

  const [filenameTemplate, setFilenameTemplate] = useRecoilState(
    filenameTemplateState
  )

  const [url, setUrl] = useState('')
  const [workingUrl, setWorkingUrl] = useState('')

  const [isPlaylist, setIsPlaylist] = useState(false)

  const argsBuilder = useMemo(() =>
    new CliArguments().fromString(settings.cliArgs), [settings.cliArgs]
  )

  const { i18n } = useI18n()
  const { client } = useRPC()

  const urlInputRef = useRef<HTMLInputElement>(null)
  const customFilenameInputRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setCustomArgs('')
  }, [open])

  /**
    * Retrive url from input, cli-arguments from checkboxes and emits via WebSocket
  */
  const sendUrl = (immediate?: string) => {
    const codes = new Array<string>()
    if (pickedVideoFormat !== '') codes.push(pickedVideoFormat)
    if (pickedAudioFormat !== '') codes.push(pickedAudioFormat)
    if (pickedBestFormat !== '') codes.push(pickedBestFormat)

    client.download({
      url: immediate || url || workingUrl,
      args: `${argsBuilder.toString()} ${toFormatArgs(codes)} ${downloadTemplate}`,
      pathOverride: downloadPath ?? '',
      renameTo: settings.fileRenaming ? filenameTemplate : '',
      playlist: isPlaylist,
    })

    setUrl('')
    setWorkingUrl('')

    setTimeout(() => {
      resetInput()
      setDownloadFormats(undefined)
      onDownloadStart(immediate || url || workingUrl)
    }, 250)
  }

  /**
   * Retrive url from input and display the formats selection view
   */
  const sendUrlFormatSelection = () => {
    setWorkingUrl(url)
    setUrl('')
    setPickedAudioFormat('')
    setPickedVideoFormat('')
    setPickedBestFormat('')

    client.formats(url)
      ?.then(formats => {
        setDownloadFormats(formats.result)
        resetInput()
      })
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
  }

  const handleFilenameTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilenameTemplate(e.target.value)
  }

  const handleCustomArgsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomArgs(e.target.value)
  }

  const parseUrlListFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (!files || files.length < 1) {
      return
    }

    const file = await files[0].text()

    file
      .split('\n')
      .filter(u => isValidURL(u))
      .forEach(u => sendUrl(u))
  }

  const resetInput = () => {
    urlInputRef.current!.value = ''
    if (customFilenameInputRef.current) {
      customFilenameInputRef.current!.value = ''
    }
  }

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
    >
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={isPending}
      />
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Download
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{
        backgroundColor: (theme) => theme.palette.background.default,
        minHeight: (theme) => `calc(99vh - ${theme.mixins.toolbar.minHeight}px)`
      }}>
        <Container sx={{ my: 4 }} >
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper
                elevation={4}
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Grid container>
                  <TextField
                    fullWidth
                    ref={urlInputRef}
                    label={i18n.t('urlInput')}
                    variant="outlined"
                    onChange={handleUrlChange}
                    disabled={
                      !isConnected
                      || (settings.formatSelection && downloadFormats != null)
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <label htmlFor="icon-button-file">
                            <input
                              hidden
                              id="icon-button-file"
                              type="file"
                              accept=".txt"
                              onChange={e => parseUrlListFile(e)}
                            />
                            <IconButton
                              color="primary"
                              aria-label="upload file"
                              component="span"
                            >
                              <FileUpload />
                            </IconButton>
                          </label>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  {
                    settings.enableCustomArgs &&
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label={i18n.t('customArgsInput')}
                        variant="outlined"
                        onChange={handleCustomArgsChange}
                        value={customArgs}
                        disabled={
                          !isConnected ||
                          (settings.formatSelection && downloadFormats != null)
                        }
                      />
                    </Grid>
                  }
                  {
                    settings.fileRenaming &&
                    <Grid item xs={settings.pathOverriding ? 8 : 12}>
                      <TextField
                        sx={{ mt: 1 }}
                        ref={customFilenameInputRef}
                        fullWidth
                        label={i18n.t('customFilename')}
                        variant="outlined"
                        value={filenameTemplate}
                        onChange={handleFilenameTemplateChange}
                        disabled={
                          !isConnected ||
                          (settings.formatSelection && downloadFormats != null)
                        }
                      />
                    </Grid>
                  }
                  {
                    settings.pathOverriding &&
                    <Grid item xs={4}>
                      <FormControl fullWidth>
                        <Autocomplete
                          disablePortal
                          options={availableDownloadPaths.map((dir) => ({ label: dir, dir }))}
                          autoHighlight
                          getOptionLabel={(option) => option.label}
                          onChange={(_, value) => {
                            setDownloadPath(value?.dir!)
                          }}
                          renderOption={(props, option) => (
                            <Box
                              component="li"
                              sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
                              {...props}>
                              {option.label}
                            </Box>
                          )}
                          sx={{ width: '100%', mt: 1 }}
                          renderInput={(params) => <TextField {...params} label={i18n.t('customPath')} />}
                        />
                      </FormControl>
                    </Grid>
                  }
                </Grid>
                <Suspense>
                  {savedTemplates.length > 0 && <ExtraDownloadOptions />}
                </Suspense>
                <Grid container spacing={1} pt={2} justifyContent="space-between">
                  <Grid item>
                    <Grid item>
                      <FormControlLabel
                        control={<Checkbox onChange={() => setIsPlaylist(state => !state)} />}
                        checked={isPlaylist}
                        label={i18n.t('playlistCheckbox')}
                      />
                    </Grid>
                    <Grid item>
                      <FormControlLabel
                        control={
                          <Checkbox
                            onChange={() => setCliArgs(argsBuilder.toggleExtractAudio().toString())}
                          />
                        }
                        checked={argsBuilder.extractAudio}
                        onChange={() => setCliArgs(argsBuilder.toggleExtractAudio().toString())}
                        disabled={settings.formatSelection}
                        label={i18n.t('extractAudioCheckbox')}
                      />
                    </Grid>
                  </Grid>
                  <Grid item>
                    <Button
                      variant="contained"
                      disabled={url === ''}
                      onClick={() => settings.formatSelection
                        ? startTransition(() => sendUrlFormatSelection())
                        : sendUrl()
                      }
                    >
                      {
                        settings.formatSelection
                          ? i18n.t('selectFormatButton')
                          : i18n.t('startButton')
                      }
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid >
          {/* Format Selection grid */}
          {downloadFormats && <FormatsGrid
            downloadFormats={downloadFormats}
            onBestQualitySelected={(id) => {
              setPickedBestFormat(id)
              setPickedVideoFormat('')
              setPickedAudioFormat('')
            }}
            onVideoSelected={(id) => {
              setPickedVideoFormat(id)
              setPickedBestFormat('')
            }}
            onAudioSelected={(id) => {
              setPickedAudioFormat(id)
              setPickedBestFormat('')
            }}
            onClear={() => {
              setPickedAudioFormat('')
              setPickedVideoFormat('')
              setPickedBestFormat('')
            }}
            onSubmit={sendUrl}
            pickedBestFormat={pickedBestFormat}
            pickedVideoFormat={pickedVideoFormat}
            pickedAudioFormat={pickedAudioFormat}
          />}
        </Container>
      </Box>
    </Dialog>
  )
}

export default DownloadDialog