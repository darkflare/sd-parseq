import type { ChartData, ChartOptions, ScriptableContext } from 'chart.js';
import {
    CategoryScale, Chart as ChartJS, Legend, LegendItem, LinearScale, LineElement, PointElement, Title,
    Tooltip
} from 'chart.js';
//disabling crosshair plugin because it seems to cause errors on some systems.
//import { CrosshairPlugin } from 'chartjs-plugin-crosshair';
import 'chartjs-plugin-dragdata';
//@ts-ignore
import 'chart.js/auto';
//@ts-ignore
import annotationPlugin from 'chartjs-plugin-annotation';
import React from 'react';
import { Line } from 'react-chartjs-2';
import { fieldNametoRGBa, frameToBeats, frameToSeconds } from './utils';

const ChartJSAddPointPlugin = {
    id: 'click',
    afterInit: function (chartInstance: any) {
        chartInstance.canvas.addEventListener('dblclick', (e: MouseEvent) => {
            let x = chartInstance.scales.x.getValueForPixel(e.offsetX);
            const pluginOptions = chartInstance.config.options.plugins.click;
            pluginOptions.addPoint(x);
        })
    }
}

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartJSAddPointPlugin,
    //    CrosshairPlugin,
    annotationPlugin
);

//@ts-ignore
//Interaction.modes.interpolate = Interpolate

export class Editable extends React.Component<{
    renderedData: RenderedData,
    displayedFields: string[],
    as_percents: boolean,
    updateKeyframe: (field: string, index: number, value: number) => void;
    addKeyframe: (index: number) => void;
    clearKeyframe: (field: string, index: number) => void;
    markers: { x: number, label: string, color: string, top: boolean }[];
}> {

    isKeyframeWithFieldValue = (field: string, idx: number): boolean => {
        return this.props.renderedData.keyframes
            .some(frame => frame['frame'] === idx
                && field in frame
                && frame[field] !== '');
    }

    isKeyframe = (idx: number): boolean => {
        return this.props.renderedData.keyframes
            .some(frame => frame['frame'] === idx);
    }

    render() {

        const annotations = this.props.markers.reduce((acc: any, marker: { x: number, label: string, color: string, top: boolean }, idx: number) => {
            return {
                ...acc,
                ['line' + idx]: {
                    xMin: marker.x,
                    xMax: marker.x,
                    borderColor: marker.color,
                    borderDash: [5, 5],
                    borderWidth: 1,
                    label: {
                        display: true,
                        content: marker.label,
                        ...(marker.top ? { position: 'end', yAdjust: -5 } : { position: 'start', yAdjust: 5 }),
                        font: { size: '8' },
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: 3
                    },
                    callout: {
                        display: true,
                    }
                }
            }
        }, {});

        if ((!this.props.renderedData.rendered_frames)) {
            //log.debug("Editable input not set.")
            return <></>;
        }

        const capturedThis = this;

        let options: ChartOptions<'line'> = {
            animation: {
                duration: 175,
                delay: 0
            },
            normalised: true,
            responsive: true,
            aspectRatio: 4,
            onClick: (event: any, elements: any, chart: any) => {
                if (elements[0] && event.native.shiftKey) {
                    const datasetIndex = elements[0].datasetIndex;
                    const field = chart.data.datasets[datasetIndex].label;
                    const index = chart.scales.x.getValueForPixel(event.x);
                    this.props.clearKeyframe(field, index);
                }
            },
            plugins: {
                legend: {
                    position: 'bottom' as const,
                    labels: {
                        usePointStyle: true,
                        sort: (a: LegendItem, b: LegendItem) => {
                            return a.text.localeCompare(b.text);
                        }
                    }
                },
                tooltip: {
                    position: 'nearest',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            const field: string = context.dataset.label || '';
                            const frame = capturedThis.props.renderedData.rendered_frames[context.parsed.x];
                            const value = frame[field].toFixed(3);
                            //@ts-ignore
                            const maxValue = capturedThis.props.renderedData.rendered_frames_meta[field].max;
                            const pcOfMax = (frame[field] / maxValue * 100).toFixed(2)
                            const label = `${context.dataset.label}: ${value} (${pcOfMax}% of max) `;

                            return label;
                        },
                        title: function (items) {
                            const frame = items[0].parsed.x;
                            const fps = capturedThis.props.renderedData.options.output_fps;
                            const bpm = capturedThis.props.renderedData.options.bpm;
                            return `Frame ${frame.toString()} [beat ${frameToBeats(frame, fps, bpm).toFixed(2)}; ${frameToSeconds(frame, fps).toFixed(2)}s]`
                        }
                    }

                },
                //@ts-ignore - additional plugin config data is not declated in type.
                crosshair: {
                    line: {
                        color: '#F66',  // crosshair line color
                        width: 1        // crosshair line width
                    },
                    sync: {
                        enabled: false,            // enable trace line syncing with other charts
                    },
                    zoom: {
                        enabled: true,                                      // enable zooming
                        zoomboxBackgroundColor: 'rgba(66,133,244,0.2)',     // background color of zoom box 
                        zoomboxBorderColor: '#48F',                         // border color of zoom box
                        zoomButtonText: 'Reset Zoom',                       // reset zoom button text
                        zoomButtonClass: 'reset-zoom',                      // reset zoom button class
                    },

                },
                //@ts-ignore - additional plugin config data is not declated in type.
                dragData: {
                    round: 4,
                    showTooltip: true,
                    onDragStart: (e: MouseEvent, element: any) => {
                    },
                    onDrag: (e: MouseEvent, datasetIndex: number, index: number, value: number) => {
                        return this.isKeyframe(index);
                    },
                    onDragEnd: (e: MouseEvent, datasetIndex: number, index: number, value: number) => {
                        if (!this.isKeyframe(index)) {
                            return;
                        }
                        let field = this.props.displayedFields[datasetIndex];
                        if (this.props.as_percents) {
                            //@ts-ignore
                            const maxValue = this.props.renderedData.rendered_frames_meta[field].max;
                            value = value * maxValue / 100;
                        }
                        this.props.updateKeyframe(field, index, value);
                    },
                },
                scales: {
                    y: {
                        // disables datapoint dragging for the entire axis
                        dragData: false
                    }
                },
                click: {
                    addPoint: (index: number) => {
                        if (!this.isKeyframe(index)) {
                            this.props.addKeyframe(index);
                        }
                    }
                },
                annotation: {
                    annotations
                }
            },
        };

        let chartData: ChartData<'line'> = {
            labels: this.props.renderedData.rendered_frames.map((idx, frame) => frame.toString()),
            datasets: [
                ...this.props.displayedFields.map((field) => {
                    return {
                        label: field,
                        data: this.props.renderedData.rendered_frames.map((frame) => this.props.as_percents ? (frame[field + '_pc']) : frame[field] || 0),
                        borderColor: fieldNametoRGBa(field, 255),
                        borderWidth: 0.25,
                        pointRadius: (ctx: ScriptableContext<'line'>) => this.isKeyframe(ctx.dataIndex) ? 6 : 2,
                        pointBackgroundColor: (ctx: ScriptableContext<'line'>) => this.isKeyframeWithFieldValue(field, ctx.dataIndex) ? fieldNametoRGBa(field, 1) : fieldNametoRGBa(field, 0.2),
                        backgroundColor: fieldNametoRGBa(field, 255),
                        pointStyle: (ctx: ScriptableContext<'line'>) => this.isKeyframe(ctx.dataIndex) ? 'circle' : 'cross',
                    }
                })
            ]
        };

        return <Line options={options} data={chartData} />;
    }
}
