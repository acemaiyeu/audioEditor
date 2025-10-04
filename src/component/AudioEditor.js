import React, { Component, createRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { motion, AnimatePresence } from "framer-motion"; 
import Draggable from "react-draggable"; 
import toast, { Toaster } from 'react-hot-toast'; 
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver'; 
import axios from 'axios'; 
import "./animations.css"; 
import cssFileObject from './animations.css'


class AudioEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      wavesurfer: null,
      lyrics: [], 
      currentLyric: "",
      currentTime: 0,
      
      // File URLs (chỉ dùng cho Preview)
      videoFile: null,
      imageFile: null,
      
      // File Objects (dùng để gửi lên Server)
      audioFileObject: null, 
      backgroundFileObject: null, 
      
      isPlaying: false,
      editingIndex: null, 
      editingText: "", 
      editingTime: "",
      editingFontSize: "28",
      editingFontFamily: "Arial",
      
      globalFontFamily: "Arial", 
      globalFontSize: 28, 
      previewRatio: '16:9', 
      
      audioFileName: "untitled_audio", 
      
      // CÁC STATE CHO POLLING/DOWNLOAD
      isExporting: false,       
      exportedFileName: null,   
      pollingIntervalId: null,  
    };
    this.waveformRef = React.createRef();
    this.videoRef = React.createRef();
    this.currentLyricInputRef = React.createRef();
    this.importInputRef = React.createRef(); 
    this.loadProjectInputRef = React.createRef(); 

    this.resolutionPresets = {
        '16:9': { width: 960, height: 540, label: '16:9 (Landscape - HD)' },
        '4:3': { width: 720, height: 540, label: '4:3 (Cổ điển)' },
        '1:1': { width: 540, height: 540, label: '1:1 (Square - Instagram)' },
        '9:16': { width: 304, height: 540, label: '9:16 (Portrait - TikTok/Reels)' },
    };
    
    this.positionPresets = {
        'default': { x: 0, y: 20 },      
        'top-left': { x: 20, y: 20 },
        'top-mid': { x: 0, y: 20 },      
        'top-right': { x: 940, y: 20 }, 

        'mid-left': { x: 20, y: 250 },
        'mid-mid': { x: 0, y: 250 },     
        'mid-right': { x: 940, y: 250 }, 

        'bottom-left': { x: 20, y: 480 },
        'bottom-mid': { x: 0, y: 480 },  
        'bottom-right': { x: 940, y: 480 }, 
    };
  }
  
  // ====================================================================
  // 💾 LOGIC LƯU/TẢI DỰ ÁN (JSON) VÀ EXCEL
  // ====================================================================
  // (Các hàm handleSaveProject, handleLoadProject, handleDownloadTemplate, 
  // handleExportLyrics, exportDataToExcel, handleImportLyrics, processImport giữ nguyên)
  
  handleSaveProject = () => {
      const { lyrics, globalFontFamily, globalFontSize, previewRatio, audioFileName } = this.state;
      
      if (lyrics.length === 0) {
          toast.error("Không có dữ liệu lyric để lưu dự án.");
          return;
      }

      const lyricsToSave = lyrics.map(lyric => {
          const { nodeRef, ...rest } = lyric;
          return rest;
      });
      
      const projectData = {
          version: "1.0",
          globalSettings: {
              globalFontFamily,
              globalFontSize,
              previewRatio,
          },
          lyrics: lyricsToSave,
      };

      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      
      const fileName = `PJ_${audioFileName.replace(/\.[^/.]+$/, "")}.json`;
      
      saveAs(blob, fileName);
      
      toast.success(`Đã lưu dự án thành công với tên file: ${fileName}`);
  };

  handleLoadProject = (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              try {
                  const data = evt.target.result;
                  const projectData = JSON.parse(data);
                  
                  if (!projectData.globalSettings || !projectData.lyrics) {
                      toast.error("Cấu trúc file JSON không hợp lệ. Vui lòng kiểm tra lại.");
                      return;
                  }
                  
                  const { globalSettings, lyrics } = projectData;
                  
                  const newGlobalFontFamily = String(globalSettings.globalFontFamily || this.state.globalFontFamily);
                  const newGlobalFontSize = parseInt(globalSettings.globalFontSize) || this.state.globalFontSize;
                  const newPreviewRatio = String(globalSettings.previewRatio || this.state.previewRatio);
                  
                  const newLyrics = lyrics.map(lyric => ({
                      ...lyric,
                      time: parseFloat(lyric.time) || 0,
                      duration: parseFloat(lyric.duration) || 4.5,
                      text: String(lyric.text || "New Lyric"),
                      animation: String(lyric.animation || "fade-in-basic"),
                      fontSize: parseInt(lyric.fontSize) || newGlobalFontSize,
                      fontFamily: String(lyric.fontFamily) || newGlobalFontFamily,
                      x: parseFloat(lyric.x) || 0,
                      y: parseFloat(lyric.y) || 20,
                      nodeRef: createRef(),
                  }));
                  
                  this.setState({
                      globalFontFamily: newGlobalFontFamily,
                      globalFontSize: newGlobalFontSize,
                      previewRatio: newPreviewRatio,
                      lyrics: newLyrics,
                  });
                  
                  toast.success(`Đã tải thành công dự án với ${newLyrics.length} dòng lyrics!`);
              } catch (error) {
                  toast.error("Lỗi khi đọc/phân tích file JSON. Vui lòng đảm bảo đó là file .json hợp lệ.");
                  console.error("Load Project Error:", error);
              }
          };
          reader.readAsText(file);
      }
      e.target.value = null;
  };
  
  handleDownloadTemplate = () => {
    const templateData = [
      { 
        Time_Start_Sec: 0.5, 
        Duration_Sec: 4.5, 
        Text: "Đây là dòng lyric mẫu\nCó thể xuống dòng", 
        Animation: "fade-in-basic", 
        Font_Size_Px: 28,
        Font_Family: "Arial",
        Position_X: 0, 
        Position_Y: 20,
      },
    ];
    this.exportDataToExcel(templateData, "Lyric_Template.xlsx");
  };

  handleExportLyrics = () => {
    if (this.state.lyrics.length === 0) {
      toast.error("Không có dữ liệu lyric để xuất! Vui lòng nhấn 'Tải Mẫu' để lấy cấu trúc.");
      return;
    }
    const exportData = this.state.lyrics.map(lyric => ({
      Time_Start_Sec: lyric.time.toFixed(2),
      Duration_Sec: lyric.duration.toFixed(1),
      Text: lyric.text,
      Animation: lyric.animation,
      Font_Size_Px: lyric.fontSize,
      Font_Family: lyric.fontFamily,
      Position_X: lyric.x.toFixed(0),
      Position_Y: lyric.y.toFixed(0),
    }));

    this.exportDataToExcel(exportData, "Lyrics_Data_Export.xlsx");
  };

  exportDataToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lyrics");

    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        saveAs(blob, fileName); 
        toast.success(`Đã xuất thành công file ${fileName}!`); 
    } catch (error) {
        toast.error("Lỗi khi tạo file Excel. Hãy chắc chắn bạn đã cài đặt 'xlsx' và 'file-saver'!"); 
        console.error("Export Error:", error);
    }
  };

  handleImportLyrics = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); 

            if (json.length < 2) {
                toast.error("File Excel không chứa dữ liệu hợp lệ (cần ít nhất 1 hàng header và 1 hàng data).");
                return;
            }
            const headers = json[0];
            const dataRows = json.slice(1);
            
            const structuredJson = dataRows.map(row => 
                headers.reduce((obj, header, index) => {
                    obj[header] = typeof row[index] === 'string' ? row[index] : row[index];
                    return obj;
                }, {})
            );
            
            if (structuredJson.length === 0) {
                toast.error("File Excel không chứa dữ liệu hợp lệ.");
                return;
            }
            
            if (this.state.lyrics.length > 0) {
                toast((t) => (
                    <div
                        style={{ 
                            background: '#ffc107', 
                            color: 'black', 
                            padding: '12px', 
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        <b>Cảnh báo!</b> Dữ liệu lyrics hiện tại sẽ bị ghi đè. Bạn có muốn tiếp tục?
                        <div style={{ marginTop: 10 }}>
                            <button 
                                onClick={() => {
                                    this.processImport(structuredJson);
                                    toast.dismiss(t.id);
                                }}
                                style={{ backgroundColor: '#5cb85c', color: 'white', border: 'none', padding: '5px 10px', marginRight: '10px' }}
                            >
                                Ghi đè
                            </button>
                            <button onClick={() => toast.dismiss(t.id)} style={{ backgroundColor: '#f0ad4e', color: 'white', border: 'none', padding: '5px 10px' }}>
                                Hủy
                            </button>
                        </div>
                    </div>
                ), { duration: 10000 });
                e.target.value = null; 
                return; 
            }
            
            this.processImport(structuredJson);

        } catch (error) {
            toast.error("Lỗi khi đọc/xử lý file Excel. Vui lòng kiểm tra định dạng và tên cột.");
            console.error("Import Error:", error);
        }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = null;
  };

  processImport = (structuredJson) => {
      const newLyrics = structuredJson.map((row, index) => {
          const defaultPos = this.positionPresets['top-mid'];
          
          const time = parseFloat(row.Time_Start_Sec);
          const duration = parseFloat(row.Duration_Sec);
          const text = String(row.Text || `Lyric ${index + 1}`).trim(); 
          const animation = String(row.Animation || 'fade-in-basic');
          const fontSize = parseInt(row.Font_Size_Px); 
          const fontFamily = String(row.Font_Family || this.state.globalFontFamily);
          const x = parseFloat(row.Position_X);
          const y = parseFloat(row.Position_Y);

          return {
              time: isNaN(time) || time < 0 ? 0 : time,
              duration: isNaN(duration) || duration <= 0 ? 4.5 : duration,
              text: text, 
              animation: animation,
              fontSize: isNaN(fontSize) || fontSize <= 0 ? this.state.globalFontSize : fontSize, 
              fontFamily: fontFamily,
              x: isNaN(x) ? defaultPos.x : x,
              y: isNaN(y) ? defaultPos.y : y,
              nodeRef: createRef(),
          };
      });
      
      this.setState({ lyrics: newLyrics });
      toast.success(`Đã nhập thành công ${newLyrics.length} dòng lyrics và cập nhật đầy đủ thuộc tính!`);
  }
  
  // ====================================================================
  // 🎬 LOGIC EXPORT VIDEO (AXIOS & POLLING)
  // ====================================================================

  /**
   * Bắt đầu quá trình polling (hỏi) trạng thái xử lý của video từ server.
   */
  startPolling = (fileName) => {
    const API_STATUS_URL = `http://localhost:8888/api/export-status/${fileName}`;

    const checkStatus = async () => {
        try {
            const response = await axios.get(API_STATUS_URL);
            
            if (response.data.is_ready) {
                // 1. Dừng Polling
                clearInterval(this.state.pollingIntervalId);
                
                // 2. Cập nhật UI và thông báo
                this.setState({ isExporting: false, exportedFileName: fileName, pollingIntervalId: null });
                toast.success(
                    <b style={{ color: '#007bff' }}>✅ Video "{fileName}" đã được xử lý xong! Nhấn nút Tải Xuống.</b>, 
                    { duration: 10000 }
                );
                
            } else {
                // Video chưa xong, tiếp tục đợi
                console.log(`[Polling] Video đang xử lý...`);
            }

        } catch (error) {
            // Xử lý lỗi (ví dụ: file không tồn tại, Job thất bại)
            clearInterval(this.state.pollingIntervalId);
            this.setState({ isExporting: false, exportedFileName: null, pollingIntervalId: null });
            
            let message = "Lỗi khi kiểm tra trạng thái video.";
            if (error.response && error.response.status === 404) {
                message = `Tác vụ xử lý video không tìm thấy hoặc đã bị hủy.`;
            }
            toast.error(message, { duration: 8000 });
            console.error("Polling Error:", error);
        }
    };

    // Bắt đầu interval
    const intervalId = setInterval(checkStatus, 5000); // Poll mỗi 5 giây
    this.setState({ pollingIntervalId: intervalId });
    
    // Chạy lần đầu tiên ngay lập tức
    checkStatus(); 
  };


  handleExportVideo = () => {
    const { 
        lyrics, 
        audioFileObject, 
        backgroundFileObject, 
        globalFontFamily, 
        globalFontSize, 
        previewRatio 
    } = this.state;
    
    // 1. Kiểm tra điều kiện cần thiết
    if (!audioFileObject) {
        toast.error("Vui lòng tải file Audio (.mp3, .wav) lên trước.");
        return;
    }
    if (lyrics.length === 0) {
        toast.error("Vui lòng thêm ít nhất một dòng lyrics.");
        return;
    }

    // 2. Chuẩn bị FormData
    const formData = new FormData();
    formData.append('audio_file', audioFileObject);
    if (backgroundFileObject) {
        formData.append('background_file', backgroundFileObject); 
    }
    
    const lyricsToSave = lyrics.map(({ nodeRef, ...rest }) => rest);
    formData.append('lyrics', JSON.stringify(lyricsToSave));
    
    const globalSettings = {
        globalFontFamily,
        globalFontSize,
        previewRatio: this.resolutionPresets[previewRatio], 
    };
    formData.append('global_settings', JSON.stringify(globalSettings));

    // 🧩 Thêm CSS file
formData.append('css_file', cssFileObject); 

    // 3. Gửi Request API bằng Axios
    const API_URL = 'http://localhost:8888/api/export-video'; 
    
    const exportPromise = new Promise(async (resolve, reject) => {
        try {
            const response = await axios.post(API_URL, formData);
            
            const data = response.data;

            if (data.job_dispatched) {
                // BẮT ĐẦU QUÁ TRÌNH POLLING
                this.setState({ 
                    isExporting: true, 
                    exportedFileName: data.file_name 
                });
                
                this.startPolling(data.file_name);
                
                resolve(`Yêu cầu xuất video (${data.file_name}) đã được gửi thành công! Bắt đầu kiểm tra trạng thái...`);
            } else {
                reject(new Error('Server phản hồi OK nhưng không xác nhận việc đẩy Job vào Queue.'));
            }

        } catch (error) {
            let errorMessage = 'Lỗi không xác định khi gửi yêu cầu.';
            
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                if (status === 422 && errorData.errors) {
                    const validationErrors = Object.values(errorData.errors).flat();
                    errorMessage = `Lỗi Validation: ${validationErrors.join(', ')}`;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else {
                    errorMessage = `Lỗi Server (HTTP ${status}): ${error.response.statusText}`;
                }

            } else if (error.request) {
                errorMessage = 'Lỗi mạng: Không thể kết nối tới Server API.';
            } else {
                errorMessage = error.message;
            }
            
            reject(new Error(errorMessage));
        }
    });

    // 4. Hiển thị thông báo Toast
    toast.promise(exportPromise, {
        loading: 'Đang gửi yêu cầu xuất video đến server...',
        success: (message) => <b>{message}</b>,
        error: (err) => <b>Lỗi gửi yêu cầu: {err.message}</b>,
    });
  };

  // ====================================================================
  // ⬆️ HÀM XỬ LÝ UPLOAD - LƯU FILE OBJECT
  // ====================================================================

  handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file && this.state.wavesurfer) {
      this.state.wavesurfer.load(URL.createObjectURL(file));
      this.setState({ 
          isPlaying: false, 
          audioFileName: file.name,
          audioFileObject: file, 
          isExporting: false,    
          exportedFileName: null,
      }); 
      if (this.videoRef.current) {
        this.videoRef.current.load();
      }
      toast.success(`Đã tải Audio thành công! Tên file: ${file.name}`);
    }
  };

  handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        this.setState({ 
            videoFile: URL.createObjectURL(file), 
            imageFile: null,
            backgroundFileObject: file, 
            isExporting: false,
            exportedFileName: null,
        });
        toast.success("Đã tải Video thành công!");
    }
  };

  handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        this.setState({ 
            imageFile: URL.createObjectURL(file), 
            videoFile: null,
            backgroundFileObject: file, 
            isExporting: false,
            exportedFileName: null,
        });
        toast.success("Đã tải Image thành công!");
    }
  };
  
  // ====================================================================
  // LIFE CYCLE VÀ CÁC HÀM PHỤ TRỢ KHÁC
  // ====================================================================

  componentDidMount() {
    // 🌟 FIX LỖI CONTAINER NOT FOUND: Kiểm tra ref trước khi khởi tạo
    if (!this.waveformRef.current) {
        console.error("WaveSurfer container không tìm thấy!");
        return; 
    }
    
    const wavesurfer = WaveSurfer.create({
        container: this.waveformRef.current,
        waveColor: "lightgray",
        progressColor: "blue",
        height: 80,
    });
    this.setState({ wavesurfer });

    wavesurfer.on("audioprocess", () => {
        const time = wavesurfer.getCurrentTime();
        this.setState({ currentTime: time });
        if (this.videoRef.current) {
            this.videoRef.current.currentTime = time;
        }
    });

    wavesurfer.on("seek", () => {
        const time = wavesurfer.getCurrentTime();
        this.setState({ currentTime: time });
        if (this.videoRef.current) {
            this.videoRef.current.currentTime = time;
        }
    });

    wavesurfer.on("finish", () => {
        this.setState({ isPlaying: false });
        if (this.videoRef.current) {
            this.videoRef.current.pause();
        }
    });
  }

  componentWillUnmount() {
    // DỌN DẸP INTERVAL KHI UNMOUNT
    if (this.state.wavesurfer) {
        this.state.wavesurfer.destroy();
    }
    if (this.state.pollingIntervalId) {
        clearInterval(this.state.pollingIntervalId);
    }
  }

  togglePlay = () => {
    const { wavesurfer, isPlaying } = this.state;
    if (wavesurfer) {
      wavesurfer.playPause();
      this.setState({ isPlaying: !isPlaying });
      if (this.videoRef.current) {
        if (!isPlaying) {
          this.videoRef.current.play();
        } else {
          this.videoRef.current.pause();
        }
      }
    }
  };

  addLyric = () => {
    const { currentLyric, currentTime, lyrics, globalFontFamily, globalFontSize } = this.state;
    
    const finalLyricText = currentLyric.trim(); 
    
    if (finalLyricText) {
      const defaultPosition = this.positionPresets['top-mid'];
      this.setState({
        lyrics: [
          ...lyrics,
          {
            time: parseFloat(currentTime.toFixed(2)),
            duration: 4.5, 
            text: finalLyricText, 
            animation: "fade-in-basic", 
            x: defaultPosition.x, 
            y: defaultPosition.y, 
            fontSize: globalFontSize, 
            fontFamily: globalFontFamily, 
            nodeRef: createRef(),
          },
        ],
        currentLyric: "",
      }, () => {
          if (this.currentLyricInputRef.current) {
              this.currentLyricInputRef.current.focus();
          }
          toast.success(`Đã thêm lyric mới tại ${currentTime.toFixed(2)}s`);
      });
    }
  };

  handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault(); 
      this.addLyric();
    }
  };

  changeAnimation = (index, anim) => {
    const lyrics = [...this.state.lyrics];
    lyrics[index].animation = anim;
    this.setState({ lyrics });
  };

  handleDragStop = (index, e, data) => {
    const lyrics = [...this.state.lyrics];
    
    const currentResolution = this.resolutionPresets[this.state.previewRatio];
    const maxX = currentResolution.width;
    const maxY = currentResolution.height;
    
    const newX = data.x;
    if (Math.abs(newX) < 10 && Math.abs(newX) > 0) { 
        lyrics[index].x = 0;
    } else {
        lyrics[index].x = Math.max(0, Math.min(newX, maxX));
    }
    
    lyrics[index].y = Math.max(0, Math.min(data.y, maxY));
    
    this.setState({ lyrics });
  };

  handleDeleteLyric = (index) => {
    toast.custom((t) => (
        <div
            style={{ 
                background: '#ffc107', 
                color: 'black', 
                padding: '12px', 
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
        >
            <b>Xác nhận xóa:</b> Bạn có muốn xóa dòng lyric số {index + 1}?
            <div style={{ marginTop: 10 }}>
                <button 
                    onClick={() => {
                        const lyrics = this.state.lyrics.filter((_, i) => i !== index);
                        this.setState({ lyrics, editingIndex: null }); 
                        toast.success(`Đã xóa lyric số ${index + 1}!`);
                        toast.dismiss(t.id);
                    }}
                    style={{ backgroundColor: '#d9534f', color: 'white', border: 'none', padding: '5px 10px', marginRight: '10px' }}
                >
                    Xóa
                </button>
                <button onClick={() => toast.dismiss(t.id)} style={{ backgroundColor: '#f0ad4e', color: 'white', border: 'none', padding: '5px 10px' }}>
                    Hủy
                </button>
            </div>
        </div>
    ), { duration: 10000 });
  };

  startEditing = (index) => {
    const lyric = this.state.lyrics[index];
    this.setState({
      editingIndex: index,
      editingText: lyric.text,
      editingTime: lyric.time.toFixed(2),
      editingFontSize: lyric.fontSize.toString(), 
      editingFontFamily: lyric.fontFamily,
    });
  };

  saveEditing = (index) => {
    const { lyrics, editingText, editingTime, editingFontSize, editingFontFamily } = this.state;
    const newTime = parseFloat(editingTime);
    const newSize = parseInt(editingFontSize);
    const finalEditingText = editingText.trim(); 

    if (finalEditingText && !isNaN(newTime) && newTime >= 0 && !isNaN(newSize) && newSize > 0) {
        const updatedLyrics = [...lyrics];
        updatedLyrics[index].text = finalEditingText;
        updatedLyrics[index].time = newTime;
        updatedLyrics[index].fontSize = newSize; 
        updatedLyrics[index].fontFamily = editingFontFamily; 

        this.setState({
            lyrics: updatedLyrics,
            editingIndex: null,
            editingText: "",
            editingTime: "",
            editingFontSize: this.state.globalFontSize.toString(), 
            editingFontFamily: this.state.globalFontFamily, 
        });
        toast.success(`Đã lưu thay đổi cho lyric số ${index + 1}!`);
    } else {
        toast.error("Nội dung, thời gian hoặc kích thước chữ không hợp lệ!");
    }
  };

  cancelEditing = () => {
    this.setState({
      editingIndex: null,
      editingText: "",
      editingTime: "",
      editingFontSize: this.state.globalFontSize.toString(),
      editingFontFamily: this.state.globalFontFamily,
    });
  };
  
  handleGlobalFontChange = (e) => {
    const newFont = e.target.value;
    const updatedLyrics = this.state.lyrics.map(lyric => ({
        ...lyric,
        fontFamily: newFont 
    }));
    this.setState({
        globalFontFamily: newFont,
        lyrics: updatedLyrics,
    });
    toast("Đã đổi Font chữ chung cho toàn bộ lyrics!", { icon: '✒️' });
  };
  
  handleGlobalSizeChange = (e) => {
    const newSize = parseInt(e.target.value);
    if (!isNaN(newSize) && newSize > 0) {
        const updatedLyrics = this.state.lyrics.map(lyric => ({
            ...lyric,
            fontSize: newSize
        }));
        this.setState({
            globalFontSize: newSize,
            lyrics: updatedLyrics,
        });
        toast(`Đã đổi Kích thước chữ chung thành ${newSize}px!`, { icon: '📏' });
    }
  };
  
  getAnimationVariants = (animType) => {
    const stagger = 0.01;  
    const duration = 0.05; 
    
    const exitDuration = 0.4; 
    const defaultExit = { opacity: 0, y: 5, transition: { duration: exitDuration } }; 

    let blockVariants = {
        hidden: { opacity: 0, x: animType.includes('left') ? -50 : (animType.includes('right') ? 50 : 0) },
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }, 
        exit: defaultExit, 
    };
    
    let charVariants = {
        exit: defaultExit 
    };
    let containerVariants = { 
        hidden: {}, 
        visible: { transition: { staggerChildren: stagger } },
        exit: { transition: { staggerChildren: stagger, staggerDirection: -1 } } 
    };
    let textStyle = {}; 
    
    switch (animType) {
        case "throw-out": 
            charVariants = {
                hidden: { opacity: 0, y: 100, rotate: -45, scale: 0.5 },
                visible: { opacity: 1, y: 0, rotate: 0, scale: 1, transition: { type: "spring", stiffness: 150, damping: 15 } }, 
                exit: { opacity: 0, y: -50, rotate: 45, scale: 0.5, transition: { duration: exitDuration } }
            };
            break;
        case "golden-dust": 
            charVariants = {
                hidden: { opacity: 0, scale: 0.8, filter: 'brightness(50%)' },
                visible: { 
                    opacity: 1, 
                    scale: 1, 
                    filter: 'brightness(100%)',
                    transition: { duration: duration, ease: "easeOut" } 
                },
                exit: { opacity: 0, scale: 0.5, filter: 'brightness(0%)', transition: { duration: exitDuration, ease: "easeOut" } }
            };
            textStyle = { textShadow: "0 0 5px gold, 0 0 10px #ffcc00" }; 
            break;
        case "wave-in": 
            charVariants = {
                hidden: { opacity: 0, y: 50 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 150, damping: 15 } }, 
                exit: { opacity: 0, y: -50, transition: { duration: exitDuration } }
            };
            break;
        case "lazer-cut": 
            charVariants = {
                hidden: { backgroundPosition: "100% 0", transition: { duration: 0.1 } },
                visible: { 
                    backgroundPosition: "0% 0", 
                    transition: { duration: duration, ease: "easeOut" } 
                },
                exit: { backgroundPosition: "100% 0", transition: { duration: exitDuration, ease: "easeOut" } }
            };
            textStyle = {
                backgroundImage: 'linear-gradient(90deg, #fff 0%, #fff 50%, #f00 50%, #f00 100%)', 
                backgroundSize: '200% 100%', 
                backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                color: 'transparent', textShadow: "0 0 2px rgba(0,0,0,0.5)", 
            };
            containerVariants.visible.transition.staggerChildren = stagger; 
            containerVariants.exit = { transition: { staggerChildren: stagger, staggerDirection: -1 } };
            break;
        case "fade-in-basic": 
        default:
            charVariants = {
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: duration } },
                exit: defaultExit 
            };
            blockVariants = {
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.3 } },
                exit: defaultExit 
            };
            break;
    }
    
    return { containerVariants, charVariants, blockVariants, textStyle };
  };

  renderLyricText(lyric, isWordWrap) { 
    const text = lyric.text;
    const { containerVariants, charVariants, blockVariants, textStyle } = this.getAnimationVariants(lyric.animation);
    
    const isLazerCut = lyric.animation === "lazer-cut";
    
    const commonTextStyle = { 
        display: "block", 
        color: 'white', 
        fontWeight: "bold",
        fontSize: `${lyric.fontSize}px`, 
        fontFamily: lyric.fontFamily,
        textShadow: "1px 1px 4px rgba(0,0,0,0.7)", 
        ...textStyle,
    };
    
    if (isWordWrap) {
        const parts = text.split('\n');
        
        return (
            <motion.div
                variants={blockVariants}
                initial="hidden"
                animate="visible"
                exit="exit" 
                style={{ 
                    ...commonTextStyle, 
                    whiteSpace: 'normal', 
                    textShadow: commonTextStyle.textShadow 
                }}
            >
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        <span style={{ display: 'block' }}>{part}</span>
                        {index < parts.length - 1 && <br />}
                    </React.Fragment>
                ))}
            </motion.div>
        );
    }

    const textWithoutNewLines = text.replace(/\n/g, ' '); 

    const words = textWithoutNewLines.split(/(\s+)/).filter(w => w.length > 0); 
    let charIndexCounter = 0;

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit" 
            style={{ ...commonTextStyle, whiteSpace: 'nowrap' }} 
        >
            {words.map((word, wordIndex) => {
                if (word.match(/\s+/)) {
                    return (
                        <span key={`space-${wordIndex}`} style={{ whiteSpace: 'pre' }}>
                            {word}
                        </span>
                    );
                }
                
                const chars = word.split("");

                return chars.map((char, charIndexInWord) => {
                    const uniqueKey = `char-${charIndexCounter++}`;
                    return (
                        <motion.span
                            key={uniqueKey}
                            variants={charVariants}
                            style={{ 
                                display: "inline-block", 
                                ...(isLazerCut ? { ...textStyle, display: "inline-block" } : {}),
                            }}
                        >
                            {char}
                        </motion.span>
                    );
                });
            })}
        </motion.div>
    );
  }
  
  applyPresetPosition = (index, presetKey) => {
    const preset = this.positionPresets[presetKey] || this.positionPresets['default'];
    const lyrics = [...this.state.lyrics];
    
    const currentResolution = this.resolutionPresets[this.state.previewRatio];
    let newX = preset.x;
    if (presetKey.includes('right')) {
        newX = currentResolution.width - 20; 
    }
    
    lyrics[index].x = newX;
    lyrics[index].y = preset.y;
    this.setState({ lyrics });
  };
  
  handleRatioChange = (e) => {
    const newRatio = e.target.value;
    const currentResolution = this.resolutionPresets[newRatio];
    
    const updatedPresets = { ...this.positionPresets };
    Object.keys(updatedPresets).forEach(key => {
        if (key.includes('right')) {
            updatedPresets[key].x = currentResolution.width - 20;
        }
    });

    const defaultPosition = updatedPresets['top-mid'];
    const resetLyrics = this.state.lyrics.map(lyric => ({
        ...lyric,
        x: defaultPosition.x,
        y: defaultPosition.y,
    }));
    
    this.positionPresets = updatedPresets; 

    this.setState({ 
        previewRatio: newRatio, 
        lyrics: resetLyrics 
    });
  };

  // ====================================================================
  // 🎨 RENDER
  // ====================================================================

  render() {
    const { lyrics, currentLyric, currentTime, videoFile, imageFile, isPlaying, editingIndex, editingText, editingTime, editingFontSize, editingFontFamily, globalFontFamily, globalFontSize, previewRatio, audioFileName, audioFileObject, backgroundFileObject, isExporting, exportedFileName } = this.state;
    
    const animationOptions = [
      { value: "fade-in-basic", label: "Fade In (Cơ bản)" }, 
      { value: "throw-out", label: "Throw Out (Ký tự)" }, 
      { value: "golden-dust", label: "Golden Dust (Ký tự)" },
      { value: "wave-in", label: "Wave In (Ký tự)" }, 
      { value: "lazer-cut", label: "Lazer Cut (Ký tự)" }, 
    ];
    
    const fontOptions = [
        "Arial",
        "Verdana",
        "Tahoma",
        "Georgia",
        "Times New Roman",
        "Courier New",
        "Roboto",
        "Sans-serif"
    ];

    const currentResolution = this.resolutionPresets[previewRatio] || this.resolutionPresets['16:9'];
    const previewWidth = `${currentResolution.width}px`;
    const previewHeight = `${currentResolution.height}px`;
    
    const backgroundInfo = backgroundFileObject 
        ? (backgroundFileObject.type.startsWith('video') ? "Video Đã Tải" : "Ảnh Đã Tải") 
        : "Nền Đen Mặc Định";
        
    const DOWNLOAD_URL = `http://localhost:8888/api/download-video/${exportedFileName}`; 

    return (
      <div style={{ padding: "20px", fontFamily: "Arial" }}>
        <Toaster position="top-right" reverseOrder={false} /> 
        
        <h2>🎵 Video Lyric Editor by EmSad</h2>
        <hr/>

        {/* Upload File */}
        <div style={{ marginBottom: "10px", display: "flex", gap: "15px" }}>
          <label>Audio: <input type="file" accept="audio/*" onChange={this.handleAudioUpload} /></label>
          <label>Video: <input type="file" accept="video/*" onChange={this.handleVideoUpload} /></label>
          <label>Image: <input type="file" accept="image/*" onChange={this.handleImageUpload} /></label>
        </div>
        <div style={{ marginBottom: "10px", fontSize: "14px", color: "#666" }}>
            **Tên Audio:** {audioFileName}
        </div>
        
        {/* Control Box: Font, Ratio, Import/Export */}
        <div style={{ width: "80%", margin: "20px auto", display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #eee', padding: '15px', borderRadius: '4px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'space-between' }}>
                {/* Global Font/Size Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        **Font chữ chung (Global):**
                        <select
                            value={globalFontFamily}
                            onChange={this.handleGlobalFontChange}
                            style={{ padding: '8px' }}
                            title="Chọn Font chữ áp dụng cho toàn bộ lyrics"
                        >
                            {fontOptions.map(font => (
                                <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        **Kích thước chữ chung (Global Size):**
                        <input
                            type="number"
                            min="10"
                            max="100"
                            value={globalFontSize}
                            onChange={this.handleGlobalSizeChange}
                            style={{ width: "60px", padding: '8px' }}
                            title="Đặt kích thước chữ (px) áp dụng cho toàn bộ lyrics"
                        /> px
                    </div>

                </div>
                
                {/* Tùy chọn Kích thước Khung hình */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    **Kích thước Preview:**
                    <select
                        value={previewRatio}
                        onChange={this.handleRatioChange}
                        style={{ padding: '8px' }}
                        title="Chọn tỉ lệ khung hình cho video/ảnh"
                    >
                        {Object.keys(this.resolutionPresets).map(ratio => (
                            <option key={ratio} value={ratio}>
                                {this.resolutionPresets[ratio].label} ({ratio})
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            
            <hr style={{ margin: '10px 0', borderTop: '1px dashed #ddd' }} />
            
            {/* JSON Project Data (Lưu toàn bộ Project) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '10px' }}>
                <b style={{ minWidth: '160px' }}>📝 Project Data (JSON):</b>

                <button 
                    onClick={() => this.loadProjectInputRef.current.click()} 
                    style={{ padding: '8px 15px', backgroundColor: '#5bc0de', color: 'white', border: 'none' }}
                >
                    ⬆️ Tải Project (.json)
                </button>
                <input 
                    type="file" 
                    accept=".json" 
                    ref={this.loadProjectInputRef} 
                    onChange={this.handleLoadProject} 
                    style={{ display: 'none' }}
                />

                <button 
                    onClick={this.handleSaveProject} 
                    style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none' }}
                >
                    💾 Lưu Project (.json)
                </button>
                <span style={{ fontSize: '12px', color: '#666' }}> (Lưu tất cả: lyrics, font, size, khung hình)</span>
            </div>

            {/* Import/Export Lyrics (Excel) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: '1px dashed #eee' }}>
                <b style={{ minWidth: '160px' }}>📄 Lyrics Data (Excel):</b>

                <button 
                    onClick={this.handleDownloadTemplate} 
                    style={{ padding: '8px 15px', backgroundColor: '#f0ad4e', color: 'white', border: 'none' }}
                >
                    ⬇️ Tải Mẫu
                </button>
                
                <button 
                    onClick={() => this.importInputRef.current.click()} 
                    style={{ padding: '8px 15px', backgroundColor: '#5cb85c', color: 'white', border: 'none' }}
                >
                    ⬆️ Import
                </button>
                <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    ref={this.importInputRef} 
                    onChange={this.handleImportLyrics} 
                    style={{ display: 'none' }}
                />

                <button 
                    onClick={this.handleExportLyrics} 
                    style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none' }}
                >
                    💾 Export
                </button>
                <span style={{ fontSize: '12px', color: '#666' }}> (Chỉ lưu/tải dữ liệu lyrics thô)</span>
            </div>
            
            <hr style={{ margin: '10px 0', borderTop: '1px solid #c9302c' }} />
            
            {/* 🌟 PHẦN EXPORT VIDEO VÀ POLLING STATUS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingTop: '10px' }}>
                <b style={{ minWidth: '160px', color: '#c9302c' }}>🎬 Export Video:</b>
                
                {isExporting ? (
                    // TRẠNG THÁI ĐANG XỬ LÝ (POLLING)
                    <button 
                        style={{ padding: '10px 20px', backgroundColor: '#ffc107', color: 'black', border: 'none', fontWeight: 'bold', cursor: 'wait' }}
                        disabled={true}
                    >
                        ⏳ Đang xử lý Job: {exportedFileName ? 'Kiểm tra trạng thái...' : 'Gửi Job...'}
                    </button>
                ) : exportedFileName ? (
                    // TRẠNG THÁI XỬ LÝ XONG -> NÚT DOWNLOAD
                    <a 
                        href={DOWNLOAD_URL}
                        download={exportedFileName}
                        style={{ 
                            padding: '10px 20px', 
                            backgroundColor: '#0275d8', 
                            color: 'white', 
                            border: 'none', 
                            fontWeight: 'bold', 
                            textDecoration: 'none'
                        }}
                        onClick={() => {
                            toast.success(`Đang tải file ${exportedFileName}...`);
                        }}
                    >
                        ⬇️ Tải Xuống Video ({exportedFileName})
                    </a>
                ) : (
                    // TRẠNG THÁI CHUẨN BỊ XUẤT (NÚT BÌNH THƯỜNG)
                    <button 
                        onClick={this.handleExportVideo} 
                        style={{ padding: '10px 20px', backgroundColor: '#c9302c', color: 'white', border: 'none', fontWeight: 'bold' }}
                        disabled={!audioFileObject || this.state.lyrics.length === 0}
                        title={!audioFileObject ? "Vui lòng tải Audio để xuất video" : (this.state.lyrics.length === 0 ? "Vui lòng thêm lyrics để xuất video" : "")}
                    >
                        ⚡️ EXPORT VIDEO (Gửi lên Laravel)
                    </button>
                )}
                
                <span style={{ fontSize: '12px', color: '#c9302c' }}>
                    **Nền hiện tại:** {backgroundInfo} 
                </span>
            </div>
        </div>
        <hr/>

        {/* Preview */}
        <div
          id="preview-container" 
          style={{
            width: previewWidth,
            height: previewHeight,
            backgroundColor: (videoFile || imageFile) ? "#333" : "#000", 
            margin: "20px auto", 
            position: "relative", 
            overflow: "hidden", 
            border: "1px solid #ccc",
          }}
        >
          {/* Nền Video/Image */}
          {videoFile ? (
            <video
              ref={this.videoRef}
              src={videoFile}
              style={{ 
                  position: 'absolute', 
                  left: 0, 
                  top: 0, 
                  width: "100%", 
                  height: "100%", 
                  objectFit: "cover", 
                  zIndex: 0 
              }}
              muted
            />
          ) : imageFile ? (
            <img
              src={imageFile}
              alt="Background"
              style={{ 
                  position: 'absolute', 
                  left: 0, 
                  top: 0, 
                  width: "100%", 
                  height: "100%", 
                  objectFit: "cover", 
                  zIndex: 0 
              }}
            />
          ) : (
            <div style={{ color: "gray", textAlign: "center", paddingTop: "120px", zIndex: 0 }}>
              Không có Video/Image. Nền đen sẽ được sử dụng.
            </div>
          )}

          {/* VÙNG CONTROL MỚI (Nằm trong Preview) */}
          <div style={{
              position: 'absolute',
              bottom: 0, 
              left: 0,
              width: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              padding: '10px 15px',
              display: "flex", 
              alignItems: "center",
              gap: "20px",
              zIndex: 300, 
          }}>
              <button onClick={this.togglePlay} style={{ padding: '8px 15px' }}>
                  {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <span style={{ color: 'white', fontWeight: 'bold' }}>
                  ⏱ {currentTime.toFixed(2)}s
              </span>
          </div>

          {/* Framer Motion Draggable lyric */}
          <AnimatePresence>
            {lyrics.map((lyric, index) => {
              const isActive =
                currentTime >= lyric.time && currentTime <= lyric.time + lyric.duration;

              if (!isActive) return null; 

              const isMid = lyric.x === 0; 
              const isWordWrap = !isMid; 
              const isRight = lyric.x > (currentResolution.width / 2); 

              let containerStyle = {
                  position: "absolute",
                  cursor: "move",
                  zIndex: editingIndex === index ? 200 : 100, 
                  transform: 'none', 
                  width: isMid ? '100%' : `${currentResolution.width * 0.95}px`, 
                  maxWidth: '100%', 
              };
              
              let textWrapperStyle = {
                  display: 'block', 
                  transform: 'none',
                  width: '100%', 
                  textAlign: isMid ? 'center' : (isRight ? 'right' : 'left'),
              };
              
              let dragX = lyric.x;

              if (isWordWrap && isRight) {
                  dragX = lyric.x - (currentResolution.width * 0.95); 
              }

              return (
                <Draggable
                  key={index} 
                  nodeRef={lyric.nodeRef}
                  position={{ x: dragX, y: lyric.y }} 
                  onStop={(e, data) => this.handleDragStop(index, e, data)}
                  bounds="parent" 
                >
                    <motion.div 
                        key={`lyric-motion-${index}`} 
                        ref={lyric.nodeRef}
                        style={containerStyle} 
                    >
                        <span style={textWrapperStyle}> 
                            {this.renderLyricText(lyric, isWordWrap)} 
                        </span>
                    </motion.div>
                </Draggable>
              );
            })}
          </AnimatePresence>
        </div>
        <hr/>

        {/* Waveform Container (Nằm dưới Preview) */}
        <div
          style={{ width: "80%", margin: "20px auto 0 auto" }} 
        >
            <div 
              ref={this.waveformRef} // Đảm bảo ref được gắn đúng
              style={{ width: "100%", height: "100px" }} 
            ></div>
        </div>
        
        {/* Add lyric */}
        <div style={{ width: "80%", margin: "30px auto", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <textarea
            ref={this.currentLyricInputRef} 
            placeholder="Nhập lyric (Dùng Shift+Enter hoặc Ctrl+Enter để xuống dòng thủ công. Enter để thêm)"
            value={currentLyric}
            onChange={(e) => this.setState({ currentLyric: e.target.value })}
            onKeyPress={this.handleKeyPress} 
            rows="3"
            style={{ padding: '8px', marginRight: '10px', width: '300px', resize: 'vertical' }}
          />
          <button onClick={this.addLyric} style={{ padding: '8px 15px' }} disabled={!currentLyric.trim()}>
            ➕ Thêm Lyric tại {currentTime.toFixed(2)}s
          </button>
        </div>
        <hr/>

        {/* List lyrics */}
        <div style={{ marginTop: "20px", width: "80%", margin: "20px auto" }}>
          <h3>Danh sách Lyrics</h3>
          {lyrics.map((lyric, index) => (
            <div
              key={index}
              style={{
                marginBottom: "10px",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: editingIndex === index ? '#fff7e6' : (currentTime >= lyric.time && currentTime <= lyric.time + lyric.duration ? '#e6f7ff' : 'white'),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              {editingIndex === index ? (
                // Chế độ chỉnh sửa (Editing Mode)
                <div style={{ display: 'flex', gap: '10px', flexGrow: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                        type="number"
                        step="0.01"
                        value={editingTime}
                        onChange={(e) => this.setState({ editingTime: e.target.value })}
                        style={{ width: "70px", padding: '5px', fontWeight: 'bold' }}
                        title="Thời gian bắt đầu (giây)"
                    />
                    <textarea 
                        value={editingText}
                        onChange={(e) => this.setState({ editingText: e.target.value })}
                        style={{ flexGrow: 1, padding: '5px', minWidth: '150px' }}
                        title="Nội dung Lyric"
                        rows="2"
                    />

                    <input 
                        type="number"
                        min="10"
                        max="100"
                        value={editingFontSize}
                        onChange={(e) => this.setState({ editingFontSize: e.target.value })}
                        style={{ width: "50px", padding: '5px' }}
                        title="Kích thước chữ (px) riêng cho dòng này"
                    /> px

                    <select
                        value={editingFontFamily}
                        onChange={(e) => this.setState({ editingFontFamily: e.target.value })}
                        style={{ padding: '5px' }}
                        title="Chọn Font chữ riêng cho dòng này"
                    >
                        {fontOptions.map(font => (
                            <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                        ))}
                    </select>

                    <select
                        value={lyric.animation}
                        onChange={(e) => this.changeAnimation(index, e.target.value)}
                        style={{ marginLeft: "10px", padding: '5px' }}
                        title="Hiệu ứng chuyển động"
                    >
                        {animationOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    <button onClick={() => this.saveEditing(index)} style={{ padding: '5px 10px', backgroundColor: '#5cb85c', color: 'white', border: 'none' }}>
                        ✔ Lưu
                    </button>
                    <button onClick={this.cancelEditing} style={{ padding: '5px 10px', backgroundColor: '#f0ad4e', color: 'white', border: 'none' }}>
                        ✖ Hủy
                    </button>
                </div>
              ) : (
                // Chế độ hiển thị bình thường
                <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'bold', minWidth: '80px' }}>
                        {lyric.time.toFixed(2)}s
                    </span>
                    <span style={{ margin: '0 15px', color: '#555', minWidth: '150px' }}>
                         [{lyric.fontFamily} | **{lyric.fontSize}px**]
                    </span>
                    {/* Hiển thị \n thành khoảng trắng cho danh sách */}
                    <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                         : {lyric.text.replace(/\n/g, ' ')}
                    </span>

                    {/* Selector Preset Vị trí */}
                    <select
                        value={Object.keys(this.positionPresets).find(key => 
                            this.positionPresets[key].x === lyric.x && this.positionPresets[key].y === lyric.y
                        ) || 'custom'}
                        onChange={(e) => this.applyPresetPosition(index, e.target.value)}
                        style={{ marginLeft: "10px", padding: '5px' }}
                        title={`Vị trí hiện tại: (X: ${lyric.x.toFixed(0)}, Y: ${lyric.y.toFixed(0)}). Kéo thả để chỉnh Custom.`}
                    >
                        <option value="custom" disabled={true}>Vị trí (Kéo thả)</option>
                        {Object.keys(this.positionPresets).map(key => (
                            <option key={key} value={key}>
                                {key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' ')}
                            </option>
                        ))}
                    </select>

                    <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={lyric.duration}
                        onChange={(e) => {
                            const newDuration = parseFloat(e.target.value);
                            if (newDuration > 0) {
                                const lyrics = [...this.state.lyrics];
                                lyrics[index].duration = newDuration;
                                this.setState({ lyrics });
                            }
                        }}
                        style={{ width: "60px", marginLeft: "10px" }}
                        title="Thời lượng (giây)"
                    />{" "}
                    giây
                    <select
                        value={lyric.animation}
                        onChange={(e) => this.changeAnimation(index, e.target.value)}
                        style={{ marginLeft: "10px" }}
                        title="Hiệu ứng chuyển động"
                    >
                        {animationOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    
                    {/* NÚT CHỨC NĂNG */}
                    <button 
                        onClick={() => this.startEditing(index)} 
                        style={{ marginLeft: '15px', padding: '5px 10px' }}
                    >
                        ✏️ Sửa
                    </button>
                    <button 
                        onClick={() => this.handleDeleteLyric(index)} 
                        style={{ marginLeft: '5px', padding: '5px 10px', backgroundColor: '#d9534f', color: 'white', border: 'none' }}
                    >
                        🗑 Xóa
                    </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
}

export default AudioEditor;