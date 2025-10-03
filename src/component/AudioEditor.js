import React, { Component, createRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { motion } from "framer-motion"; 
import Draggable from "react-draggable"; 
import "./animations.css"; 

// ====================================================================
// 🛠️ KHAI BÁO THƯ VIỆN THỰC TẾ 
// ====================================================================
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver'; 
// ====================================================================


class AudioEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      wavesurfer: null,
      lyrics: [], 
      currentLyric: "",
      currentTime: 0,
      videoFile: null,
      imageFile: null,
      isPlaying: false,
      editingIndex: null, 
      editingText: "", 
      editingTime: "",
      editingFontSize: "28",
      editingFontFamily: "Arial",
      
      globalFontFamily: "Arial", 
      previewRatio: '16:9', 
    };
    this.waveformRef = React.createRef();
    this.videoRef = React.createRef();
    this.currentLyricInputRef = React.createRef();
    this.importInputRef = React.createRef(); 

    this.resolutionPresets = {
        '16:9': { width: 960, height: 540, label: '16:9 (Landscape - HD)' },
        '4:3': { width: 720, height: 540, label: '4:3 (Cổ điển)' },
        '1:1': { width: 540, height: 540, label: '1:1 (Square - Instagram)' },
        '9:16': { width: 304, height: 540, label: '9:16 (Portrait - TikTok/Reels)' },
    };
    
    // ====================================================================
    // 🛠️ LOGIC VỊ TRÍ CĂN GIỮA: X=0 được sử dụng cho các vị trí Mid
    // ====================================================================
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
    // ====================================================================
  }

  // ====================================================================
  // LOGIC IMPORT/EXPORT EXCEL
  // ====================================================================

  handleDownloadTemplate = () => {
    const templateData = [
      { 
        Time_Start_Sec: 0.5, 
        Duration_Sec: 3.0, 
        // Dùng \n để xuống dòng thủ công trong Excel nếu cần
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
      alert("Không có dữ liệu lyric để xuất! Vui lòng nhấn 'Tải Mẫu' để lấy cấu trúc.");
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
    } catch (error) {
        alert("Lỗi khi tạo file Excel. Hãy chắc chắn bạn đã cài đặt 'xlsx' và 'file-saver'!");
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
            // Sheet to JSON với header: 1 để giữ định dạng \n
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); 

            // Cần phải xử lý lại JSON từ array of arrays (header: 1) sang array of objects
            if (json.length < 2) {
                alert("File Excel không chứa dữ liệu hợp lệ (cần ít nhất 1 hàng header và 1 hàng data).");
                return;
            }
            const headers = json[0];
            const dataRows = json.slice(1);
            
            const structuredJson = dataRows.map(row => 
                headers.reduce((obj, header, index) => {
                    // Xử lý giá trị nếu là chuỗi (có thể chứa \n)
                    obj[header] = typeof row[index] === 'string' ? row[index] : row[index];
                    return obj;
                }, {})
            );
            
            if (structuredJson.length === 0) {
                alert("File Excel không chứa dữ liệu hợp lệ.");
                return;
            }
            
            const newLyrics = structuredJson.map((row, index) => {
                const defaultPos = this.positionPresets['top-mid'];
                const time = parseFloat(row.Time_Start_Sec);
                const duration = parseFloat(row.Duration_Sec) || 3;
                // Đảm bảo Text là string và giữ \n
                const text = String(row.Text || `Lyric ${index + 1}`).trim(); 
                const animation = String(row.Animation || 'fade-in-basic');
                const fontSize = parseInt(row.Font_Size_Px) || 28;
                const fontFamily = String(row.Font_Family || this.state.globalFontFamily);
                
                const x = parseFloat(row.Position_X) || defaultPos.x;
                const y = parseFloat(row.Position_Y) || defaultPos.y;

                return {
                    time: isNaN(time) || time < 0 ? 0 : time,
                    duration: isNaN(duration) || duration <= 0 ? 3 : duration,
                    text: text, // Giữ \n ở đây
                    animation: animation,
                    fontSize: fontSize,
                    fontFamily: fontFamily,
                    x: x,
                    y: y,
                    nodeRef: createRef(),
                };
            });

            if (this.state.lyrics.length > 0 && 
                !window.confirm("Bạn có muốn ghi đè (thay thế) hoàn toàn dữ liệu lyrics hiện tại bằng dữ liệu từ file Excel không?")) {
                e.target.value = null; 
                return;
            }

            this.setState({ lyrics: newLyrics });
            alert(`Đã nhập thành công ${newLyrics.length} dòng lyrics!`);
        } catch (error) {
            alert("Lỗi khi đọc/xử lý file Excel. Vui lòng kiểm tra định dạng và tên cột.");
            console.error("Import Error:", error);
        }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = null;
  };
  
  // ====================================================================
  // CÁC LOGIC KHÁC 
  // ====================================================================
  applyPresetPosition = (index, presetKey) => {
    const preset = this.positionPresets[presetKey] || this.positionPresets['default'];
    const lyrics = [...this.state.lyrics];
    
    const currentResolution = this.resolutionPresets[this.state.previewRatio];
    let newX = preset.x;
    // Chỉnh lại vị trí X cho căn phải
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
    // Reset vị trí X/Y khi thay đổi tỉ lệ (để tránh tràn màn hình)
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

  componentDidMount() {
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

  handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file && this.state.wavesurfer) {
      this.state.wavesurfer.load(URL.createObjectURL(file));
      this.setState({ isPlaying: false });
      if (this.videoRef.current) {
        this.videoRef.current.load();
      }
    }
  };

  handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) this.setState({ videoFile: URL.createObjectURL(file), imageFile: null });
  };

  handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) this.setState({ imageFile: URL.createObjectURL(file), videoFile: null });
  };

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
    const { currentLyric, currentTime, lyrics, globalFontFamily } = this.state;
    
    // Gán trực tiếp currentLyric vì nó đã là textarea (giữ \n)
    const finalLyricText = currentLyric.trim(); 
    
    if (finalLyricText) {
      const defaultPosition = this.positionPresets['top-mid'];
      this.setState({
        lyrics: [
          ...lyrics,
          {
            time: parseFloat(currentTime.toFixed(2)),
            duration: 3, 
            text: finalLyricText, // Lưu text có ký tự xuống dòng
            animation: "fade-in-basic", 
            x: defaultPosition.x, 
            y: defaultPosition.y, 
            fontSize: 28, 
            fontFamily: globalFontFamily, 
            nodeRef: createRef(),
          },
        ],
        currentLyric: "",
      }, () => {
          if (this.currentLyricInputRef.current) {
              this.currentLyricInputRef.current.focus();
          }
      });
    }
  };

  handleKeyPress = (e) => {
    // Ngăn hành vi mặc định khi nhấn Enter trong textarea VÀ không có modifier
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault(); 
      this.addLyric();
    }
    // Khi người dùng nhấn Shift+Enter hoặc Ctrl+Enter, nó sẽ xuống dòng trong textarea
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
    
    // Căn X về 0 nếu gần 0 để kích hoạt chế độ căn giữa/animation ký tự
    const newX = data.x;
    if (Math.abs(newX) < 10 && Math.abs(newX) > 0) { // Nếu kéo gần về 0 (center)
        lyrics[index].x = 0;
    } else {
        lyrics[index].x = Math.max(0, Math.min(newX, maxX));
    }
    
    lyrics[index].y = Math.max(0, Math.min(data.y, maxY));
    
    this.setState({ lyrics });
  };

  handleDeleteLyric = (index) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa dòng lyric này không?")) {
      const lyrics = this.state.lyrics.filter((_, i) => i !== index);
      this.setState({ lyrics, editingIndex: null }); 
    }
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
    // Lấy nội dung từ textarea (giữ \n)
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
            editingFontSize: "28",
            editingFontFamily: "Arial",
        });
    } else {
        alert("Nội dung, thời gian hoặc kích thước chữ không hợp lệ!");
    }
  };

  cancelEditing = () => {
    this.setState({
      editingIndex: null,
      editingText: "",
      editingTime: "",
      editingFontSize: "28",
      editingFontFamily: "Arial",
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
  };
  
  // ====================================================================
  // LOGIC VARIANTS & RENDER LYRIC 
  // ====================================================================

  getAnimationVariants = (animType) => {
    const stagger = 0.05;
    
    let blockVariants = {
        hidden: { opacity: 0, x: animType.includes('left') ? -50 : (animType.includes('right') ? 50 : 0) },
        visible: { opacity: 1, x: 0, transition: { duration: 0.5 } }
    };
    
    let charVariants = {};
    let containerVariants = { hidden: {}, visible: { transition: { staggerChildren: stagger } } };
    let textStyle = {}; 
    
    switch (animType) {
        case "throw-out": 
            charVariants = {
                hidden: { opacity: 0, y: 100, rotate: -45, scale: 0.5 },
                visible: { opacity: 1, y: 0, rotate: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 10 } }
            };
            break;
        case "golden-dust": 
            charVariants = {
                hidden: { opacity: 0, scale: 0.8, filter: 'brightness(50%)' },
                visible: { 
                    opacity: 1, 
                    scale: 1, 
                    filter: 'brightness(100%)',
                    transition: { duration: 0.5, ease: "easeOut" } 
                }
            };
            textStyle = { textShadow: "0 0 5px gold, 0 0 10px #ffcc00" }; 
            break;
        case "wave-in": 
            charVariants = {
                hidden: { opacity: 0, y: 50 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 12 } }
            };
            break;
        case "lazer-cut": 
            charVariants = {
                hidden: { backgroundPosition: "100% 0", transition: { duration: 0.1 } },
                visible: { 
                    backgroundPosition: "0% 0", 
                    transition: { duration: 0.5, ease: "easeOut" } 
                }
            };
            textStyle = {
                backgroundImage: 'linear-gradient(90deg, #fff 0%, #fff 50%, #f00 50%, #f00 100%)', 
                backgroundSize: '200% 100%', 
                backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                color: 'transparent', textShadow: "0 0 2px rgba(0,0,0,0.5)", 
            };
            containerVariants.visible.transition.staggerChildren = 0.05; 
            break;
        case "fade-in-basic": 
        default:
            charVariants = {
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
            };
            blockVariants = {
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.5 } }
            };
            break;
    }
    
    return { containerVariants, charVariants, blockVariants, textStyle };
  };


  /**
   * Render lyric: dùng animation ký tự nếu isWordWrap=false (căn giữa), ngược lại dùng animation khối.
   * @param {object} lyric - Đối tượng lyric.
   * @param {boolean} isWordWrap - Cờ cho biết có cho phép xuống dòng (Trái/Phải).
   */
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
        whiteSpace: isWordWrap ? "normal" : "nowrap", // Cần normal/pre-wrap khi WordWrap=true
        ...textStyle,
    };
    
    // -----------------------------------------------------
    // 1. CHẾ ĐỘ CĂN LỀ TRÁI/PHẢI (X ≠ 0)
    // TẮT animation ký tự, Dùng animation BLOCK, và XỬ LÝ \n
    // -----------------------------------------------------
    if (isWordWrap) {
        // Chia nội dung thành các phần: chuỗi text và thẻ <br/>
        const parts = text.split('\n');
        
        return (
            <motion.div
                variants={blockVariants}
                initial="hidden"
                animate="visible"
                style={{ ...commonTextStyle, textShadow: "1px 1px 4px rgba(0,0,0,0.7)", whiteSpace: 'normal' }}
            >
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        {/* Hiển thị phần văn bản */}
                        {/* Dùng span block để các phần văn bản được đặt trên dòng mới và tự động xuống dòng nếu dài */}
                        <span style={{ display: 'block' }}>{part}</span>
                        
                        {/* Thêm <br /> cho mọi ký tự \n đã được dùng để chia chuỗi (trừ phần cuối cùng) */}
                        {index < parts.length - 1 && <br />}
                    </React.Fragment>
                ))}
            </motion.div>
        );
    }

    // -----------------------------------------------------
    // 2. CHẾ ĐỘ CĂN GIỮA (X = 0)
    // Dùng animation KÝ TỰ/TỪ và LOẠI BỎ \n
    // -----------------------------------------------------
    // Loại bỏ \n thành khoảng trắng để không làm hỏng animation ký tự
    const textWithoutNewLines = text.replace(/\n/g, ' '); 

    // Chia thành từ và khoảng trắng
    const words = textWithoutNewLines.split(/(\s+)/).filter(w => w.length > 0); 
    let charIndexCounter = 0;

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={commonTextStyle} 
        >
            {words.map((word, wordIndex) => {
                // Xử lý khoảng trắng
                if (word.match(/\s+/)) {
                    return (
                        <span key={`space-${wordIndex}`} style={{ whiteSpace: 'pre' }}>
                            {word}
                        </span>
                    );
                }
                
                // Xử lý từng ký tự
                const chars = word.split("");

                return chars.map((char, charIndexInWord) => {
                    const uniqueKey = `char-${charIndexCounter++}`;
                    return (
                        <motion.span
                            key={uniqueKey}
                            variants={charVariants}
                            style={{ 
                                display: "inline-block", 
                                // Đảm bảo các thuộc tính textStyle (như lazer-cut) được áp dụng cho span
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
// ====================================================================


  render() {
    const { lyrics, currentLyric, currentTime, videoFile, imageFile, isPlaying, editingIndex, editingText, editingTime, editingFontSize, editingFontFamily, globalFontFamily, previewRatio } = this.state;

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
    
    // Đặt độ rộng căn lề là 95% khung hình
    const wrapWidth = Math.round(currentResolution.width * 0.95) + "px";


    return (
      <div style={{ padding: "20px", fontFamily: "Arial" }}>
        <h2>🎵 Video Lyric Editor</h2>
        <hr/>

        {/* Upload File */}
        <div style={{ marginBottom: "10px", display: 'flex', gap: '15px' }}>
          <label>Audio: <input type="file" accept="audio/*" onChange={this.handleAudioUpload} /></label>
          <label>Video: <input type="file" accept="video/*" onChange={this.handleVideoUpload} /></label>
          <label>Image: <input type="file" accept="image/*" onChange={this.handleImageUpload} /></label>
        </div>
        
        {/* Control Box: Font, Ratio, Import/Export */}
        <div style={{ width: "80%", margin: "20px auto", display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid #eee', padding: '15px', borderRadius: '4px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'space-between' }}>
                {/* Global Font Selector */}
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

            {/* Import/Export Lyrics */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: '1px dashed #eee' }}>
                **Lyrics Data (Excel):**

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
            </div>
        </div>
        <hr/>

        {/* Preview */}
        <div
          id="preview-container" 
          style={{
            width: previewWidth,
            height: previewHeight,
            backgroundColor: "#333",
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
            <div style={{ color: "white", textAlign: "center", paddingTop: "120px", zIndex: 0 }}>
              Upload video or image
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
          {lyrics.map((lyric, index) => {
            const isActive =
              currentTime >= lyric.time && currentTime <= lyric.time + lyric.duration;

            // X=0 -> Căn giữa (Mid), dùng animation ký tự, KHÔNG xuống dòng tự động/thủ công
            const isMid = lyric.x === 0; 
            // X > 0 -> Căn lề Trái/Phải, dùng animation khối, CÓ xuống dòng tự động/thủ công
            const isWordWrap = !isMid; 

            // Căn phải nếu lyric.x > nửa chiều rộng màn hình
            const isRight = lyric.x > (currentResolution.width / 2); 

            let containerStyle = {
                position: "absolute",
                cursor: "move",
                zIndex: editingIndex === index ? 200 : 100, 
                transform: 'none', 
                // Khi không căn giữa (isWordWrap=true), giới hạn width
                width: isMid ? '100%' : wrapWidth, 
                maxWidth: '100%', 
            };
            
            let textWrapperStyle = {
                display: 'block', 
                transform: 'none',
                width: '100%', 
                textAlign: isMid ? 'center' : (isRight ? 'right' : 'left'),
            };
            
            let dragX = lyric.x;

            return (
              isActive && (
                <Draggable
                  key={index}
                  nodeRef={lyric.nodeRef}
                  position={{ x: dragX, y: lyric.y }} 
                  onStop={(e, data) => this.handleDragStop(index, e, data)}
                  bounds="parent" 
                >
                    <div
                        ref={lyric.nodeRef}
                        style={containerStyle} 
                    >
                        <span style={textWrapperStyle}> 
                            {this.renderLyricText(lyric, isWordWrap)} 
                        </span>
                    </div>
                </Draggable>
              )
            );
          })}
        </div>
        <hr/>

        {/* Waveform Container (Nằm dưới Preview) */}
        <div
          style={{ width: "80%", margin: "20px auto 0 auto" }} 
        >
            <div 
              ref={this.waveformRef}
              style={{ width: "100%", height: "100px" }} 
            ></div>
        </div>
        
        {/* Add lyric */}
        <div style={{ width: "80%", margin: "20px auto" }}>
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
                        title="Kích thước chữ (px)"
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
                         [{lyric.fontFamily} | {lyric.fontSize}px]
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