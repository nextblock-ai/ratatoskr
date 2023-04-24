// file for the splitter component

++b / components / SplitterComponent.js
import React, { useEffect, useRef } from 'react';
import './SplitterComponent.css';

const SplitterComponent = ({
    children,
    direction = 'horizontal',
    containerStyle = {},
    resizerStyle = {},
}) => {
    const resizer = useRef(null);
    const container = useRef(null);

    useEffect(() => {
        const resizable = () => {
            const prevSibling = resizer.current.previousElementSibling;
            const nextSibling = resizer.current.nextElementSibling;
            let x = 0;
            let y = 0;
            let prevSiblingHeight = 0;
            let prevSiblingWidth = 0;

            const mouseDownHandler = (e) => {
                x = e.clientX;
                y = e.clientY;
                const rect = prevSibling.getBoundingClientRect();
                prevSiblingHeight = rect.height;
                prevSiblingWidth = rect.width;
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
            };

            const mouseMoveHandler = (e) => {
                const dx = e.clientX - x;
                const dy = e.clientY - y;
                if (direction === 'vertical') {
                    const h =
                        (prevSiblingHeight + dy) * 100 /
                        container.current.getBoundingClientRect().height;
                    prevSibling.style.height = `${h}%`;
                } else {
                    const w =
                        (prevSiblingWidth + dx) * 100 /
                        container.current.getBoundingClientRect().width;
                    prevSibling.style.width = `${w}%`;
                }
                resizer.current.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
                document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
                prevSibling.style.userSelect = 'none';
                prevSibling.style.pointerEvents = 'none';
                nextSibling.style.userSelect = 'none';
                nextSibling.style.pointerEvents = 'none';
            };

            const mouseUpHandler = () => {
                resizer.current.style.removeProperty('cursor');
                document.body.style.removeProperty('cursor');
                prevSibling.style.removeProperty('user-select');
                prevSibling.style.removeProperty('pointer-events');
                nextSibling.style.removeProperty('user-select');
                nextSibling.style.removeProperty('pointer-events');
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };

            resizer.current.addEventListener('mousedown', mouseDownHandler);
        };

        resizable();
    }, [direction]);

    return (
        <div className='splitter-container' ref={container} style={containerStyle}>
            {children}
            <div
                className='splitter-resizer'
                ref={resizer}
                data-direction={direction}
                style={resizerStyle}
            ></div>
        </div>
    );
};

export default SplitterComponent;

module.exports = {}
