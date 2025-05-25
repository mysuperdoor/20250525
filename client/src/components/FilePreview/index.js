import React, { useState, useEffect } from 'react';
import { Modal, Spin, message, Button, Space, Tooltip } from 'antd';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomInOutlined, ZoomOutOutlined, UndoOutlined } from '@ant-design/icons';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import WordPreview from '../WordPreview'; // 导入Word预览组件
import TextPreview from '../TextPreview'; // 导入Text预览组件
import { getFullFileUrl } from '../../utils/apiUtils'; // 导入API工具函数

// 注释掉原来的 worker 导入方式
// import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

// 设置PDF.js worker，使用 new URL 和 import.meta.url 的推荐方式
// 这依赖于项目的构建系统 (如 Webpack 5+) 能够正确处理此模式
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

const FilePreview = ({ visible, onClose, filename }) => {
    const [loading, setLoading] = useState(true);
    const [fileType, setFileType] = useState(null);
    const [fileUrl, setFileUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [scale, setScale] = useState(1);
    const baseWidth = 600;

    // 缩放控制函数
    const zoomIn = () => setScale(prevScale => Math.min(prevScale + 0.2, 3));
    const zoomOut = () => setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
    const resetZoom = () => setScale(1);

    // Handler for PDF load error
    const onDocumentLoadError = (error) => {
        console.error('React-PDF Document Load Error:', error);
        message.error(`PDF加载失败: ${error.message}`);
        // We can set an error state here if we want to display a more custom message in renderPreview
    };

    useEffect(() => {
        // Reset states when modal becomes visible or filename changes
        if (visible && filename) {
            setLoading(true);
            setFileType(null);
            setFileUrl(null);
            setNumPages(null);
            
            // 使用工具函数构建完整的预览URL
            const previewUrl = getFullFileUrl(`/download/preview/${encodeURIComponent(filename)}`);
            
            console.log("FilePreview - 预览文件:", filename);
            console.log("FilePreview - 完整预览URL:", previewUrl);
            
            // 获取认证token
            const token = localStorage.getItem('token');
            
            fetch(previewUrl, {
                headers: token ? {
                    'Authorization': `Bearer ${token}`
                } : {}
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
                    }
                    const contentType = response.headers.get('content-type');
                    setFileType(contentType);
                    console.log("FilePreview - 文件类型:", contentType);
                    
                    // 验证内容类型是否为JSON
                    if (contentType && contentType.includes('application/json')) {
                        // 如果是JSON类型，解析为JSON
                        return response.json();
                    }
                    
                    // 没有content-type或不是JSON类型，直接处理为二进制流
                    setFileUrl(previewUrl);
                    return null;
                })
                .then(data => {
                    if (data && data.message) {
                        // 服务器返回了错误消息
                        message.info(data.message);
                        setFileUrl(null);
                    }
                })
                .catch(error => {
                    console.error('预览文件出错:', error);
                    message.error(`预览文件获取失败: ${error.message}`);
                    setFileUrl(null);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else if (!visible) {
            // Reset when modal is closed
            setLoading(true);
            setFileType(null);
            setFileUrl(null);
            setNumPages(null);
        }
    }, [visible, filename]);

    const renderPreview = () => {
        if (loading) {
            return <Spin size="large" tip="加载中..." />;
        }

        if (!fileUrl && fileType === 'application/pdf') {
             // If fileType is PDF but fileUrl is null (likely due to fetch error or explicit clear)
             // The onLoadError in Document component will also show a message.
             // This is a fallback message if fileUrl itself is the issue before Document tries to load.
            return <div>PDF链接无效或加载失败。</div>;
        }

        if (!fileType || !fileUrl) { // Check if fileUrl is also available for supported types
            // This message is for cases where fileType might be known, but URL is missing,
            // or if fileType itself is null (e.g. initial state or fetch issue)
            return <div>无法预览此文件或文件加载失败。</div>;
        }

        if (fileType.startsWith('image/')) {
            return <img src={fileUrl} alt={filename || 'preview'} style={{ maxWidth: '100%', maxHeight: '600px' }} />;
        }
        
        // 处理Word文档预览
        if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
            fileType === 'application/msword') {
            return <WordPreview fileUrl={fileUrl} />;
        }

        if (fileType === 'application/pdf') {
            const currentWidth = Math.min(baseWidth, window.innerWidth * 0.8);
            
            // 获取token，创建带认证的请求选项
            const token = localStorage.getItem('token');
            
            return (
                <>
                    <div style={{ 
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'white',
                        padding: '10px',
                        zIndex: 1,
                        borderBottom: '1px solid #f0f0f0',
                        marginBottom: '10px',
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center'
                    }}>
                        <Space>
                            <Tooltip title="缩小">
                                <Button 
                                    icon={<ZoomOutOutlined />} 
                                    onClick={zoomOut}
                                    disabled={scale <= 0.5}
                                />
                            </Tooltip>
                            <Tooltip title="重置缩放">
                                <Button 
                                    icon={<UndoOutlined />} 
                                    onClick={resetZoom}
                                    disabled={scale === 1}
                                >
                                    {Math.round(scale * 100)}%
                                </Button>
                            </Tooltip>
                            <Tooltip title="放大">
                                <Button 
                                    icon={<ZoomInOutlined />} 
                                    onClick={zoomIn}
                                    disabled={scale >= 3}
                                />
                            </Tooltip>
                        </Space>
                    </div>
                    <div style={{ 
                        width: '100%', 
                        height: 'calc(100vh - 260px)', 
                        maxHeight:'70vh', 
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <Document
                            file={{
                                url: fileUrl,
                                httpHeaders: token ? { 'Authorization': `Bearer ${token}` } : undefined,
                                withCredentials: !!token
                            }}
                            onLoadSuccess={({ numPages }) => {
                                console.log("PDF加载成功，页数:", numPages);
                                setNumPages(numPages);
                            }}
                            onLoadError={(error) => {
                                console.error("PDF加载错误:", error);
                                onDocumentLoadError(error);
                            }}
                            loading={<Spin size="large" tip="正在加载PDF..." />}
                            options={{
                                cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                                cMapPacked: true,
                                standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
                            }}
                        >
                            {numPages && Array.from(new Array(numPages), (el, index) => (
                                <Page 
                                    key={`page_${index + 1}`} 
                                    pageNumber={index + 1} 
                                    width={currentWidth * scale}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    style={{ 
                                        marginBottom: '10px',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                    }}
                                    error={(error) => {
                                        console.error("Page渲染错误:", error);
                                        return (
                                            <div>页面渲染错误: {error.message}</div>
                                        );
                                    }}
                                />
                            ))}
                        </Document>
                    </div>
                </>
            );
        }

        if (fileType.startsWith('text/')) {
            // 使用TextPreview组件替代iframe
            return <TextPreview fileUrl={fileUrl} />;
        }

        // Fallback for unsupported but fetched types (though server should send JSON for these)
        return <div>此文件类型暂不支持直接预览。</div>;
    };

    return (
        <Modal
            title={filename ? `文件预览: ${filename}` : "文件预览"}
            open={visible}
            onCancel={onClose}
            width={'80vw'} // Use viewport width for better responsiveness
            style={{ top: 20 }} // Adjust modal position
            footer={null} // No OK/Cancel buttons needed for a preview
            destroyOnClose // Important to reset state and unmount children fully
        >
            <div style={{ textAlign: 'center', minHeight: '300px', padding: '10px' }}>
                {renderPreview()}
            </div>
        </Modal>
    );
};

export default FilePreview; 