/* 
 * Copyright (c) 2016, Pierre-Anthony Lemieux <pal@sandflow.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @module imscHTML
 */

var backgroundColorAdjustSuffix = "BackgroundColorAdjust";

(function (imscHTML, imscNames, imscStyles, imscUtils) {

    /**
     * Function that maps <pre>smpte:background</pre> URIs to URLs resolving to image resource
     * @callback IMGResolver
     * @param {string} <pre>smpte:background</pre> URI
     * @return {string} PNG resource URL
     */


    /**
     * Renders an ISD object (returned by <pre>generateISD()</pre>) into a 
     * parent element, that must be attached to the DOM. The ISD will be rendered
     * into a child <pre>div</pre>
     * with heigh and width equal to the clientHeight and clientWidth of the element,
     * unless explicitly specified otherwise by the caller. Images URIs specified 
     * by <pre>smpte:background</pre> attributes are mapped to image resource URLs
     * by an <pre>imgResolver</pre> function. The latter takes the value of <code>smpte:background</code>
     * attribute and an <code>img</code> DOM element as input, and is expected to
     * set the <code>src</code> attribute of the <code>img</code> to the absolute URI of the image.
     * <pre>displayForcedOnlyMode</pre> sets the (boolean)
     * value of the IMSC1 displayForcedOnlyMode parameter. The function returns
     * an opaque object that should passed in <code>previousISDState</code> when this function
     * is called for the next ISD, otherwise <code>previousISDState</code> should be set to 
     * <code>null</code>.
     * 
     * The <pre>options</pre> parameter can be used to configure adjustments
     * that change the presentation away from the document defaults:
     * <pre>sizeAdjust: {number}</pre> scales the text size and line padding
     * <pre>lineHeightAdjust: {number}</pre> scales the line height
     * <pre>backgroundOpacityScale: {number}</pre> scales the backgroundColor opacity
     * <pre>fontFamily: {string}</pre> comma-separated list of font family values to use, if present.
     * <pre>colorAdjust: {documentColor: replaceColor*}</pre> map of document colors and the value with which to replace them
     * <pre>colorOpacityScale: {number}</pre> opacity override on text color (ignored if zero)
     * <pre>regionOpacityScale: {number}</pre> scales the region opacity
     * <pre>textOutline: {string}</pre> textOutline value to use, if present
     * <pre>[span|p|div|body|region]BackgroundColorAdjust: {documentColor: replaceColor*}</pre> map of backgroundColors and the value with which to replace them for each element type
     * 
     * @param {Object} isd ISD to be rendered
     * @param {Object} element Element into which the ISD is rendered
     * @param {?IMGResolver} imgResolver Resolve <pre>smpte:background</pre> URIs into URLs.
     * @param {?number} eheight Height (in pixel) of the child <div>div</div> or null 
     *                  to use clientHeight of the parent element
     * @param {?number} ewidth Width (in pixel) of the child <div>div</div> or null
     *                  to use clientWidth of the parent element
     * @param {?boolean} displayForcedOnlyMode Value of the IMSC1 displayForcedOnlyMode parameter,
     *                   or false if null         
     * @param {?module:imscUtils.ErrorHandler} errorHandler Error callback
     * @param {Object} previousISDState State saved during processing of the previous ISD, or null if initial call
     * @param {?boolean} enableRollUp Enables roll-up animations (see CEA 708)
     * @param {?Object} options Configuration options
     * @return {Object} ISD state to be provided when this funtion is called for the next ISD
     */

    imscHTML.render = function (isd,
            element,
            imgResolver,
            eheight,
            ewidth,
            displayForcedOnlyMode,
            errorHandler,
            previousISDState,
            enableRollUp,
            options
            ) {

        /* maintain aspect ratio if specified */

        var height = eheight || element.clientHeight;
        var width = ewidth || element.clientWidth;

        if (isd.aspectRatio !== null) {

            var twidth = height * isd.aspectRatio;

            if (twidth > width) {

                height = Math.round(width / isd.aspectRatio);

            } else {

                width = twidth;

            }

        }

        var rootcontainer = document.createElement("div");

        rootcontainer.style.position = "relative";
        rootcontainer.style.width = width + "px";
        rootcontainer.style.height = height + "px";
        rootcontainer.style.margin = "auto";
        rootcontainer.style.top = 0;
        rootcontainer.style.bottom = 0;
        rootcontainer.style.left = 0;
        rootcontainer.style.right = 0;
        rootcontainer.style.zIndex = 0;

        var context = {
            h: height,
            w: width,
            regionH: null,
            regionW: null,
            imgResolver: imgResolver,
            displayForcedOnlyMode: displayForcedOnlyMode || false,
            isd: isd,
            errorHandler: errorHandler,
            previousISDState: previousISDState,
            enableRollUp: enableRollUp || false,
            currentISDState: {},
            flg: null, /* current fillLineGap value if active, null otherwise */
            lp: null, /* current linePadding value if active, null otherwise */
            mra: null, /* current multiRowAlign value if active, null otherwise */
            ipd: null, /* inline progression direction (lr, rl, tb) */
            bpd: null, /* block progression direction (lr, rl, tb) */
            ruby: null, /* is ruby present in a <p> */
            textEmphasis: null, /* is textEmphasis present in a <p> */
            rubyReserve: null, /* is rubyReserve applicable to a <p> */
            options: Object.assign({}, options) || {}, /* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#deep_clone : */
            /* this isn't a get-out-of-jail for avoiding mutation of the incoming options if we ever put an object reference into options */
        };

        /* canonicalise and copy colour adjustment maps */
        if (context.options.colorAdjust)
            context.options.colorAdjust = preprocessColorMapOptions(context.options.colorAdjust);
        
        var bgcColorElements = ['region', 'body', 'div', 'p', 'span'];
        var propName;
        for (var bgcei in bgcColorElements)
        {
            propName = bgcColorElements[bgcei] + backgroundColorAdjustSuffix;
            if (context.options[propName])
            context.options[propName] = preprocessColorMapOptions(context.options[propName]);
        }

        element.appendChild(rootcontainer);

        for (var i in isd.contents) {

            processElement(context, rootcontainer, isd.contents[i]);

        }

        return context.currentISDState;

    };

    function preprocessColorMapOptions(colorAdjustMap) {
        var canonicalColorMap = {};
        var colorAdjustMapEntries = Object.entries(colorAdjustMap);
        for (var i in colorAdjustMapEntries) {
            var fromColor = imscUtils.parseColor(colorAdjustMapEntries[i][0]);
            var toColor = imscUtils.parseColor(colorAdjustMapEntries[i][1]);
            if (fromColor && toColor) {
                canonicalColorMap[fromColor.toString()] = toColor;
            }
        };
        return canonicalColorMap;
    }

    function processElement(context, dom_parent, isd_element) {

        var e;

        if (isd_element.kind === 'region') {

            e = document.createElement("div");
            e.style.position = "absolute";

        } else if (isd_element.kind === 'body') {

            e = document.createElement("div");

        } else if (isd_element.kind === 'div') {

            e = document.createElement("div");

        } else if (isd_element.kind === 'image') {

            e = document.createElement("img");

            if (context.imgResolver !== null && isd_element.src !== null) {

                var uri = context.imgResolver(isd_element.src, e);

                if (uri)
                    e.src = uri;

                e.height = context.regionH;
                e.width = context.regionW;

            }

        } else if (isd_element.kind === 'p') {

            e = document.createElement("p");

        } else if (isd_element.kind === 'span') {

            if (isd_element.styleAttrs[imscStyles.byName.ruby.qname] === "container") {

                e = document.createElement("ruby");

                context.ruby = true;

            } else if (isd_element.styleAttrs[imscStyles.byName.ruby.qname] === "base") {

                e = document.createElement("rb");

            } else if (isd_element.styleAttrs[imscStyles.byName.ruby.qname] === "text") {

                e = document.createElement("rt");


            } else if (isd_element.styleAttrs[imscStyles.byName.ruby.qname] === "baseContainer") {

                e = document.createElement("rbc");


            } else if (isd_element.styleAttrs[imscStyles.byName.ruby.qname] === "textContainer") {

                e = document.createElement("rtc");


            } else if (isd_element.styleAttrs[imscStyles.byName.ruby.qname] === "delimiter") {

                /* ignore rp */

                return;

            } else {

                e = document.createElement("span");

            }

            //e.textContent = isd_element.text;

        } else if (isd_element.kind === 'br') {

            e = document.createElement("br");

        }

        if (!e) {

            reportError(context.errorHandler, "Error processing ISD element kind: " + isd_element.kind);

            return;

        }

        /* add to parent */

        dom_parent.appendChild(e);

        /* override UA default margin */
        /* TODO: should apply to <p> only */

        e.style.margin = "0";

        /* determine ipd and bpd */

        if (isd_element.kind === "region") {

            var wdir = isd_element.styleAttrs[imscStyles.byName.writingMode.qname];

            if (wdir === "lrtb" || wdir === "lr") {

                context.ipd = "lr";
                context.bpd = "tb";

            } else if (wdir === "rltb" || wdir === "rl") {

                context.ipd = "rl";
                context.bpd = "tb";

            } else if (wdir === "tblr") {

                context.ipd = "tb";
                context.bpd = "lr";

            } else if (wdir === "tbrl" || wdir === "tb") {

                context.ipd = "tb";
                context.bpd = "rl";

            }
 
        } else if (isd_element.kind === "p" && context.bpd === "tb") {

            var pdir = isd_element.styleAttrs[imscStyles.byName.direction.qname];

            context.ipd = pdir === "ltr" ? "lr" : "rl"; 
 
        }

        /* tranform TTML styles to CSS styles */

        for (var i in STYLING_MAP_DEFS) {

            var sm = STYLING_MAP_DEFS[i];

            var attr = isd_element.styleAttrs[sm.qname];

            if (attr !== undefined && sm.map !== null) {

                sm.map(context, e, isd_element, attr);

            }

        }

        var proc_e = e;

        /* do we have linePadding ? */

        var lp = isd_element.styleAttrs[imscStyles.byName.linePadding.qname];

        if (lp && (! lp.isZero())) {

            var plength = lp.multiply(lp.toUsedLength(context.w, context.h), context.options.sizeAdjust);


            if (plength > 0) {
                
                /* apply padding to the <p> so that line padding does not cause line wraps */

                var padmeasure = Math.ceil(plength) + "px";

                if (context.bpd === "tb") {

                    proc_e.style.paddingLeft = padmeasure;
                    proc_e.style.paddingRight = padmeasure;

                } else {

                    proc_e.style.paddingTop = padmeasure;
                    proc_e.style.paddingBottom = padmeasure;

                }

                context.lp = lp;
            }
        }

        // do we have multiRowAlign?

        var mra = isd_element.styleAttrs[imscStyles.byName.multiRowAlign.qname];

        if (mra && mra !== "auto") {

            /* create inline block to handle multirowAlign */

            var s = document.createElement("span");

            s.style.display = "inline-block";

            s.style.textAlign = mra;

            e.appendChild(s);

            proc_e = s;

            context.mra = mra;

        }

        /* do we have rubyReserve? */

        var rr = isd_element.styleAttrs[imscStyles.byName.rubyReserve.qname];

        if (rr && rr[0] !== "none") {
            context.rubyReserve = rr;
        }


        /* remember we are filling line gaps */

        if (isd_element.styleAttrs[imscStyles.byName.fillLineGap.qname]) {
            context.flg = true;
        }


        if (isd_element.kind === "span" && isd_element.text) {

            var te = isd_element.styleAttrs[imscStyles.byName.textEmphasis.qname];

            if (te && te.style !== "none") {

                context.textEmphasis = true;

            }

            if (imscStyles.byName.textCombine.qname in isd_element.styleAttrs &&
                    isd_element.styleAttrs[imscStyles.byName.textCombine.qname][0] === "all") {

                /* ignore tate-chu-yoku since line break cannot happen within */
                e.textContent = isd_element.text;

                if (te) {

                    applyTextEmphasis(context, e, isd_element, te);

                };

            } else {

                // wrap characters in spans to find the line wrap locations

                var cbuf = '';

                for (var j = 0; j < isd_element.text.length; j++) {

                    cbuf += isd_element.text.charAt(j);

                    var cc = isd_element.text.charCodeAt(j);

                    if (cc < 0xD800 || cc > 0xDBFF || j === isd_element.text.length) {

                        /* wrap the character(s) in a span unless it is a high surrogate */

                        var span = document.createElement("span");

                        span.textContent = cbuf;

                        /* apply textEmphasis */
                        
                        if (te) {

                            applyTextEmphasis(context, span, isd_element, te);

                        };
    
                        e.appendChild(span);

                        cbuf = '';

                    }

                }

            }
        }

        /* process the children of the ISD element */

        for (var k in isd_element.contents) {

            processElement(context, proc_e, isd_element.contents[k]);

        }

        /* list of lines */

        var linelist = [];


        /* paragraph processing */
        /* TODO: linePadding only supported for horizontal scripts */

        if ((context.lp || context.mra || context.flg || context.ruby || context.textEmphasis || context.rubyReserve) &&
                isd_element.kind === "p") {

            constructLineList(context, proc_e, linelist, null);

            /* apply rubyReserve */

            if (context.rubyReserve) {

                applyRubyReserve(linelist, context);

                context.rubyReserve = null;

            }

            /* apply tts:rubyPosition="outside" */

            if (context.ruby || context.rubyReserve) {

                applyRubyPosition(linelist, context);

                context.ruby = null;

            }

            /* apply text emphasis "outside" position */

            if (context.textEmphasis) {

                applyTextEmphasisOutside(linelist, context);

                context.textEmphasis = null;

            }

            /* insert line breaks for multirowalign */

            if (context.mra) {

                applyMultiRowAlign(linelist);

                context.mra = null;

            }

            /* add linepadding */

            if (context.lp) {

                applyLinePadding(linelist, context.lp.multiply(context.lp.toUsedLength(context.w, context.h), context.options.sizeAdjust), context);

                context.lp = null;

            }

            /* fill line gaps linepadding */

            if (context.flg) {

                var par_edges = rect2edges(proc_e.getBoundingClientRect(), context);

                applyFillLineGap(linelist, par_edges.before, par_edges.after, context);

                context.flg = null;

            }

        }


        /* region processing */

        if (isd_element.kind === "region") {

            /* build line list */

            constructLineList(context, proc_e, linelist);

            /* perform roll up if needed */

            if ((context.bpd === "tb") &&
                    context.enableRollUp &&
                    isd_element.contents.length > 0 &&
                    isd_element.styleAttrs[imscStyles.byName.displayAlign.qname] === 'after') {

                /* horrible hack, perhaps default region id should be underscore everywhere? */

                var rid = isd_element.id === '' ? '_' : isd_element.id;

                var rb = new RegionPBuffer(rid, linelist);

                context.currentISDState[rb.id] = rb;

                if (context.previousISDState &&
                        rb.id in context.previousISDState &&
                        context.previousISDState[rb.id].plist.length > 0 &&
                        rb.plist.length > 1 &&
                        rb.plist[rb.plist.length - 2].text ===
                        context.previousISDState[rb.id].plist[context.previousISDState[rb.id].plist.length - 1].text) {

                    var body_elem = e.firstElementChild;

                    var h = rb.plist[rb.plist.length - 1].after - rb.plist[rb.plist.length - 1].before;

                    body_elem.style.bottom = "-" + h + "px";
                    body_elem.style.transition = "transform 0.4s";
                    body_elem.style.position = "relative";
                    body_elem.style.transform = "translateY(-" + h + "px)";

                }

            }

            /* TODO: clean-up the spans ? */

        }
    }

    function applyLinePadding(lineList, lp, context) {

        for (var i in lineList) {

            var l = lineList[i].elements.length;

            var se = lineList[i].elements[lineList[i].start_elem];

            var ee = lineList[i].elements[lineList[i].end_elem];

            var pospadpxlen = Math.ceil(lp) + "px";

            var negpadpxlen = "-" + Math.ceil(lp) + "px";

            if (l !== 0) {

                if (context.ipd === "lr") {

                    se.node.style.borderLeftColor = se.bgcolor || "#00000000";
                    se.node.style.borderLeftStyle = "solid";
                    se.node.style.borderLeftWidth = pospadpxlen;
                    se.node.style.marginLeft = negpadpxlen;

                } else if (context.ipd === "rl") {

                    se.node.style.borderRightColor = se.bgcolor || "#00000000";
                    se.node.style.borderRightStyle = "solid";
                    se.node.style.borderRightWidth = pospadpxlen;
                    se.node.style.marginRight = negpadpxlen;

                } else if (context.ipd === "tb") {

                    se.node.style.borderTopColor = se.bgcolor || "#00000000";
                    se.node.style.borderTopStyle = "solid";
                    se.node.style.borderTopWidth = pospadpxlen;
                    se.node.style.marginTop = negpadpxlen;

                }

                if (context.ipd === "lr") {

                    ee.node.style.borderRightColor = ee.bgcolor  || "#00000000";
                    ee.node.style.borderRightStyle = "solid";
                    ee.node.style.borderRightWidth = pospadpxlen;
                    ee.node.style.marginRight = negpadpxlen;

                } else if (context.ipd === "rl") {

                    ee.node.style.borderLeftColor = ee.bgcolor || "#00000000";
                    ee.node.style.borderLeftStyle = "solid";
                    ee.node.style.borderLeftWidth = pospadpxlen;
                    ee.node.style.marginLeft = negpadpxlen;

                } else if (context.ipd === "tb") {

                    ee.node.style.borderBottomColor = ee.bgcolor || "#00000000";
                    ee.node.style.borderBottomStyle = "solid";
                    ee.node.style.borderBottomWidth = pospadpxlen;
                    ee.node.style.marginBottom = negpadpxlen;

                }

            }

        }

    }

    function applyMultiRowAlign(lineList) {

        /* apply an explicit br to all but the last line */

        for (var i = 0; i < lineList.length - 1; i++) {

            var l = lineList[i].elements.length;

            if (l !== 0 && lineList[i].br === false) {
                var br = document.createElement("br");

                var lastnode = lineList[i].elements[l - 1].node;

                lastnode.parentElement.insertBefore(br, lastnode.nextSibling);
            }

        }

    }

    function applyTextEmphasisOutside(lineList, context) {

        /* supports "outside" only */

        for (var i = 0; i < lineList.length; i++) {

            for (var j = 0; j < lineList[i].te.length; j++) {

                /* skip if position already set */

                if (lineList[i].te[j].style[TEXTEMPHASISPOSITION_PROP] &&
                    lineList[i].te[j].style[TEXTEMPHASISPOSITION_PROP] !== "none")
                    continue;

                var pos;

                if (context.bpd === "tb") {

                    pos = (i === 0) ? "left over" : "left under";


                } else {

                    if (context.bpd === "rl") {

                        pos = (i === 0) ? "right under" : "left under";

                    } else {

                        pos = (i === 0) ? "left under" : "right under";

                    }

                }

                lineList[i].te[j].style[TEXTEMPHASISPOSITION_PROP] = pos;

            }

        }

    }

    function applyRubyPosition(lineList, context) {

        for (var i = 0; i < lineList.length; i++) {

            for (var j = 0; j < lineList[i].rbc.length; j++) {

                /* skip if ruby-position already set */

                if (lineList[i].rbc[j].style[RUBYPOSITION_PROP])
                    continue;

                var pos;

                if (RUBYPOSITION_ISWK) {

                    /* WebKit exception */

                    pos = (i === 0) ? "before" : "after";

                } else if (context.bpd === "tb") {

                    pos = (i === 0) ? "over" : "under";


                } else {

                    if (context.bpd === "rl") {

                        pos = (i === 0) ? "over" : "under";

                    } else {

                        pos = (i === 0) ? "under" : "over";

                    }

                }

                lineList[i].rbc[j].style[RUBYPOSITION_PROP] = pos;

            }

        }

    }

    function applyRubyReserve(lineList, context) {

        for (var i = 0; i < lineList.length; i++) {

            var ruby = document.createElement("ruby");

            var rb = document.createElement("rb");
            rb.textContent = "\u200B";

            ruby.appendChild(rb);

            var rt1;
            var rt2;

            var fs = context.rubyReserve[1].toUsedLength(context.w, context.h) + "px";

            if (context.rubyReserve[0] === "both" || (context.rubyReserve[0] === "outside" && lineList.length == 1)) {

                rt1 = document.createElement("rtc");
                rt1.style[RUBYPOSITION_PROP] = RUBYPOSITION_ISWK ? "after" : "under";
                rt1.textContent = "\u200B";
                rt1.style.fontSize = fs;

                rt2 = document.createElement("rtc");
                rt2.style[RUBYPOSITION_PROP] = RUBYPOSITION_ISWK ? "before" : "over";
                rt2.textContent = "\u200B";
                rt2.style.fontSize = fs;

                ruby.appendChild(rt1);
                ruby.appendChild(rt2);

            } else {

                rt1 = document.createElement("rtc");
                rt1.textContent = "\u200B";
                rt1.style.fontSize = fs;

                var pos;

                if (context.rubyReserve[0] === "after" || (context.rubyReserve[0] === "outside" && i > 0)) {

                    pos = RUBYPOSITION_ISWK ? "after" : ((context.bpd === "tb" || context.bpd === "rl") ? "under" : "over");

                } else {

                    pos = RUBYPOSITION_ISWK ? "before" : ((context.bpd === "tb" || context.bpd === "rl") ? "over" : "under");

                }

                rt1.style[RUBYPOSITION_PROP] = pos;

                ruby.appendChild(rt1);

            }

            /* add in front of the first ruby element of the line, if it exists */

            var sib = null;

            for (var j = 0; j < lineList[i].rbc.length; j++) {

                if (lineList[i].rbc[j].localName === 'ruby') {

                    sib = lineList[i].rbc[j];

                    /* copy specified style properties from the sibling ruby container */
                    
                    for(var k = 0; k < sib.style.length; k++) {

                        ruby.style.setProperty(sib.style.item(k), sib.style.getPropertyValue(sib.style.item(k)));

                    }

                    break;
                }

            }

            /* otherwise add before first span */

            sib = sib || lineList[i].elements[0].node;

            sib.parentElement.insertBefore(ruby, sib);

        }

    }

    function applyFillLineGap(lineList, par_before, par_after, context) {

        /* positive for BPD = lr and tb, negative for BPD = rl */
        var s = Math.sign(par_after - par_before);

        for (var i = 0; i <= lineList.length; i++) {

            /* compute frontier between lines */

            var frontier;

            if (i === 0) {

                frontier = par_before;

            } else if (i === lineList.length) {

                frontier = par_after;

            } else {

                frontier = (lineList[i].before + lineList[i - 1].after) / 2;

            }

            /* padding amount */

            var pad;

            /* current element */

            var e;

            /* before line */

            if (i > 0) {

                for (var j = 0; j < lineList[i - 1].elements.length; j++) {

                    if (lineList[i - 1].elements[j].bgcolor === null)
                        continue;

                    e = lineList[i - 1].elements[j];

                    if (s * (e.after - frontier) < 0) {

                        pad = Math.ceil(Math.abs(frontier - e.after)) + "px";

                        e.node.style.backgroundColor = e.bgcolor;

                        if (context.bpd === "lr") {

                            e.node.style.paddingRight = pad;


                        } else if (context.bpd === "rl") {

                            e.node.style.paddingLeft = pad;

                        } else if (context.bpd === "tb") {

                            e.node.style.paddingBottom = pad;

                        }

                    }

                }

            }

            /* after line */

            if (i < lineList.length) {

                for (var k = 0; k < lineList[i].elements.length; k++) {

                    e = lineList[i].elements[k];

                    if (e.bgcolor === null)
                        continue;

                    if (s * (e.before - frontier) > 0) {

                        pad = Math.ceil(Math.abs(e.before - frontier)) + "px";

                        e.node.style.backgroundColor = e.bgcolor;

                        if (context.bpd === "lr") {

                            e.node.style.paddingLeft = pad;


                        } else if (context.bpd === "rl") {

                            e.node.style.paddingRight = pad;


                        } else if (context.bpd === "tb") {

                            e.node.style.paddingTop = pad;

                        }

                    }

                }

            }

        }

    }

    function RegionPBuffer(id, lineList) {

        this.id = id;

        this.plist = lineList;

    }

    function rect2edges(rect, context) {

        var edges = {before: null, after: null, start: null, end: null};

        if (context.bpd === "tb") {

            edges.before = rect.top;
            edges.after = rect.bottom;

            if (context.ipd === "lr") {

                edges.start = rect.left;
                edges.end = rect.right;

            } else {

                edges.start = rect.right;
                edges.end = rect.left;
            }

        } else if (context.bpd === "lr") {

            edges.before = rect.left;
            edges.after = rect.right;
            edges.start = rect.top;
            edges.end = rect.bottom;

        } else if (context.bpd === "rl") {

            edges.before = rect.right;
            edges.after = rect.left;
            edges.start = rect.top;
            edges.end = rect.bottom;

        }

        return edges;

    }

    function constructLineList(context, element, llist, bgcolor) {

        if (element.localName === "rt" || element.localName === "rtc") {

            /* skip ruby annotations */

            return;

        }

        var curbgcolor = element.style.backgroundColor || bgcolor;

        if (element.childElementCount === 0) {

            if (element.localName === 'span' || element.localName === 'rb') {

                var r = element.getBoundingClientRect();

                /* skip if span is not displayed */

                if (r.height === 0 || r.width === 0)
                    return;

                var edges = rect2edges(r, context);

                if (llist.length === 0 ||
                        (!isSameLine(edges.before, edges.after, llist[llist.length - 1].before, llist[llist.length - 1].after))
                        ) {

                    llist.push({
                        before: edges.before,
                        after: edges.after,
                        start: edges.start,
                        end: edges.end,
                        start_elem: 0,
                        end_elem: 0,
                        elements: [],
                        rbc: [],
                        te: [],
                        text: "",
                        br: false
                    });

                } else {

                    /* positive for BPD = lr and tb, negative for BPD = rl */
                    var bpd_dir = Math.sign(edges.after - edges.before);

                    /* positive for IPD = lr and tb, negative for IPD = rl */
                    var ipd_dir = Math.sign(edges.end - edges.start);

                    /* check if the line height has increased */

                    if (bpd_dir * (edges.before - llist[llist.length - 1].before) < 0) {
                        llist[llist.length - 1].before = edges.before;
                    }

                    if (bpd_dir * (edges.after - llist[llist.length - 1].after) > 0) {
                        llist[llist.length - 1].after = edges.after;
                    }

                    if (ipd_dir * (edges.start - llist[llist.length - 1].start) < 0) {
                        llist[llist.length - 1].start = edges.start;
                        llist[llist.length - 1].start_elem = llist[llist.length - 1].elements.length;
                    }

                    if (ipd_dir * (edges.end - llist[llist.length - 1].end) > 0) {
                        llist[llist.length - 1].end = edges.end;
                        llist[llist.length - 1].end_elem = llist[llist.length - 1].elements.length;
                    }

                }

                llist[llist.length - 1].text += element.textContent;

                llist[llist.length - 1].elements.push(
                        {
                            node: element,
                            bgcolor: curbgcolor,
                            before: edges.before,
                            after: edges.after
                        }
                );

            } else if (element.localName === 'br' && llist.length !== 0) {

                llist[llist.length - 1].br = true;

            }

        } else {

            var child = element.firstChild;

            while (child) {

                if (child.nodeType === Node.ELEMENT_NODE) {

                    constructLineList(context, child, llist, curbgcolor);

                    if (child.localName === 'ruby' || child.localName === 'rtc') {

                        /* remember non-empty ruby and rtc elements so that tts:rubyPosition can be applied */

                        if (llist.length > 0) {

                            llist[llist.length - 1].rbc.push(child);

                        }

                    } else if (child.localName === 'span' &&
                            child.style[TEXTEMPHASISSTYLE_PROP] &&
                            child.style[TEXTEMPHASISSTYLE_PROP] !== "none") {

                        /* remember non-empty span elements with textEmphasis */

                        if (llist.length > 0) {

                            llist[llist.length - 1].te.push(child);

                        }

                    }
                    

                }

                child = child.nextSibling;
            }
        }

    }

    function isSameLine(before1, after1, before2, after2) {

        return ((after1 < after2) && (before1 > before2)) || ((after2 <= after1) && (before2 >= before1));

    }

    function applyTextEmphasis(context, dom_element, isd_element, attr) {

        /* ignore color (not used in IMSC 1.1) */

        if (attr.style === "none") {

            dom_element.style[TEXTEMPHASISSTYLE_PROP] = "none";

            /* no need to set position, so return */
            
            return;
        
        } else if (attr.style === "auto") {

            dom_element.style[TEXTEMPHASISSTYLE_PROP] = "filled";
        
        } else {

            dom_element.style[TEXTEMPHASISSTYLE_PROP] =  attr.style + " " + attr.symbol;
        }

        /* ignore "outside" position (set in postprocessing) */

        if (attr.position === "before" || attr.position === "after") {

            var pos;

            if (context.bpd === "tb") {

                pos = (attr.position === "before") ? "left over" : "left under";


            } else {

                if (context.bpd === "rl") {

                    pos = (attr.position === "before") ? "right under" : "left under";

                } else {

                    pos = (attr.position === "before") ? "left under" : "right under";

                }

            }

            dom_element.style[TEXTEMPHASISPOSITION_PROP] = pos;
        }
    }
    function HTMLStylingMapDefintion(qName, mapFunc) {
        this.qname = qName;
        this.map = mapFunc;
    }

    var STYLING_MAP_DEFS = [

        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling backgroundColor",
                function (context, dom_element, isd_element, attr) {

                    var backgroundColorAdjustMap =
                        context.options[isd_element.kind + backgroundColorAdjustSuffix];
                    
                    var map_attr = backgroundColorAdjustMap && backgroundColorAdjustMap[attr.toString()];
                    if (map_attr)
                        attr = map_attr;

                    var opacity = attr[3];

                    /* skip if transparent */
                    if (opacity === 0)
                        return;

                    /* make sure that we allow a multiplier of 0 here*/
                    if (context.options.backgroundOpacityScale != undefined)
                        opacity = opacity * context.options.backgroundOpacityScale;

                    opacity = opacity / 255;
///////////Make the color calculations here ///////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
                    dom_element.style.backgroundColor = "rgba(" +
                            attr[0].toString() + "," +
                            attr[1].toString() + "," +
                            attr[2].toString() + "," +
                            opacity.toString() +

                    
                            ")";
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling color",
                function (context, dom_element, isd_element, attr) {
                    /*
                     * <pre>colorAdjust: {documentColor: replaceColor*}</pre> map of document colors and the value with which to replace them
                     * <pre>colorOpacityScale: {number}</pre> opacity multiplier on text color (ignored if zero)
                     */
                    var opacityMultiplier = context.options.colorOpacityScale || 1;

                    var colorAdjustMap = context.options.colorAdjust;
                    if (colorAdjustMap != undefined) {
                        var map_attr = colorAdjustMap[attr.toString()];
                        if (map_attr)
                            attr = map_attr;
                    }

///////////Make the color calculations here ///////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////     
                    // store original value
                    var Rsrgb=attr[0];
                    var Gsrgb=attr[1];
                    var Bsrgb=attr[2];
                    var Asrgb=attr[3];
             
                    if (context.options.hdr) {
            
                        /* adjust the colours for HDR */
                    // //step 1: (r, g, b)/255 → (r, g, b)
                        var r=Rsrgb/255;
                        var g=Gsrgb/255;
                        var b=Bsrgb/255;
                    // step 2: (r2.0,g2.0,b2.0) → (r,g,b)
                        r=Math.pow(r,2.0);
                        g=Math.pow(g,2.0);
                        b=Math.pow(b,2.0);
                    // Step 3:Convert to BT2020
                    //black in some spaces
                        r=(0.627403895934699*r)+(0.3292830383778848*g)+(0.0433130656874172*b);
                        g=(0.0690972893582321*r)+(0.919540395075459*g)+(0.0113623155663092*b);
                        b=(0.0163914388751502*r)+(0.0880133078772256 *g)+(0.895595253247623 *b);
                    //             
                    // // step 4:((0.265r),(0.265g),(0.265b)) → (r,g,b) 
                        r=0.265*r;
                        g=0.265*g;
                        b=0.265*b;
                    //step 5: (HLG(r),HLG(g),HLG(b)) → (r,g,b)
                        a = 0.17883277;
                        bb = 1 - (4*a);
                        c = 0.5 - (a*Math.log(4*a));

                        if (r<=(1/12)) {
                            //HLG(x) = (3x)0.5 for 0 ≤ x ≤ 1/12
                            r=Math.pow((3*r),0.5);
                        }
                        else {
                            //HLG(x) = a•ln(12x−b)+c for x > 1/12,
                            r=a*Math.log(12*r-bb)+c;
                        }

                        if (g<=(1/12)) {
                            //HLG(x) = (3x)0.5 for 0 ≤ x ≤ 1/12
                            g=Math.pow((3*g),0.5);
                        }
                        else {
                            //HLG(x) = a•ln(12x−b)+c for x > 1/12,
                            g=a*Math.log(12*g-bb)+c;
                        }
                        if (b<=(1/12)) {
                            //HLG(x) = (3x)0.5 for 0 ≤ x ≤ 1/12
                            b=Math.pow((3*b),0.5);
                        }
                        else {
                            //HLG(x) = a•ln(12x−b)+c for x > 1/12,
                            b=a*Math.log(12*b-bb)+c;
                        }
                        //step 6: Convert to 255 range
                        r=Math.round(255*r);
                        g=Math.round(255*g);
                        b=Math.round(255*b);

                        attr= [r, g , b, Asrgb]

                    }
                    else{
                        attr = [ Rsrgb, Gsrgb, Bsrgb, Asrgb ];
                        

                        
                    }


                    dom_element.style.color = "rgba(" +
                            attr[0].toString() + "," +
                            attr[1].toString() + "," +
                            attr[2].toString() + "," +
                            (opacityMultiplier * attr[3] / 255).toString() +
                            ")";

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling direction",
                function (context, dom_element, isd_element, attr) {

                    dom_element.style.direction = attr;

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling display",
                function (context, dom_element, isd_element, attr) {}
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling displayAlign",
                function (context, dom_element, isd_element, attr) {

                    /* see https://css-tricks.com/snippets/css/a-guide-to-flexbox/ */

                    /* TODO: is this affected by writing direction? */

                    dom_element.style.display = "flex";
                    dom_element.style.flexDirection = "column";


                    if (attr === "before") {

                        dom_element.style.justifyContent = "flex-start";

                    } else if (attr === "center") {

                        dom_element.style.justifyContent = "center";

                    } else if (attr === "after") {

                        dom_element.style.justifyContent = "flex-end";
                    }

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling extent",
                function (context, dom_element, isd_element, attr) {
                    /* TODO: this is super ugly */

                    context.regionH = attr.h.toUsedLength(context.w, context.h);
                    context.regionW = attr.w.toUsedLength(context.w, context.h);

                    /* 
                     * CSS height/width are measured against the content rectangle,
                     * whereas TTML height/width include padding
                     */

                    var hdelta = 0;
                    var wdelta = 0;

                    var p = isd_element.styleAttrs["http://www.w3.org/ns/ttml#styling padding"];

                    if (!p) {

                        /* error */

                    } else {

                        hdelta = p[0].toUsedLength(context.w, context.h) + p[2].toUsedLength(context.w, context.h);
                        wdelta = p[1].toUsedLength(context.w, context.h) + p[3].toUsedLength(context.w, context.h);

                    }

                    dom_element.style.height = (context.regionH - hdelta) + "px";
                    dom_element.style.width = (context.regionW - wdelta) + "px";

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling fontFamily",
                function (context, dom_element, isd_element, attr) {

                    var rslt = [];

                    /* per IMSC1 */

                    if (context.options.fontFamily) {
                        attr = context.options.fontFamily.split(",");
                    }

                    for (var i in attr) {
                        attr[i] = attr[i].trim();

                        if (attr[i] === "monospaceSerif") {

                            rslt.push("Courier New");
                            rslt.push('"Liberation Mono"');
                            rslt.push("Courier");
                            rslt.push("monospace");

                        } else if (attr[i] === "proportionalSansSerif" || attr[i] === "default") {

                            rslt.push("Arial");
                            rslt.push("Helvetica");
                            rslt.push('"Liberation Sans"');
                            rslt.push("sans-serif");

                        } else if (attr[i] === "monospace") {

                            rslt.push("monospace");

                        } else if (attr[i] === "sansSerif") {

                            rslt.push("sans-serif");

                        } else if (attr[i] === "serif") {

                            rslt.push("serif");

                        } else if (attr[i] === "monospaceSansSerif") {

                            rslt.push("Consolas");
                            rslt.push("monospace");

                        } else if (attr[i] === "proportionalSerif") {

                            rslt.push("serif");

                        } else {

                            rslt.push(attr[i]);

                        }

                    }

                    dom_element.style.fontFamily = rslt.join(",");
                }
        ),

        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling shear",
                function (context, dom_element, isd_element, attr) {

                    /* return immediately if tts:shear is 0% since CSS transforms are not inherited*/

                    if (attr === 0)
                        return;

                    var angle = attr * -0.9;

                    /* context.bpd is needed since writing mode is not inherited and sets the inline progression */

                    if (context.bpd === "tb") {

                        dom_element.style.transform = "skewX(" + angle + "deg)";

                    } else {

                        dom_element.style.transform = "skewY(" + angle + "deg)";

                    }

                }
        ),

        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling fontSize",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.fontSize = attr.multiply(attr.toUsedLength(context.w, context.h), context.options.sizeAdjust) + "px";
                }
        ),

        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling fontStyle",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.fontStyle = attr;
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling fontWeight",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.fontWeight = attr;
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling lineHeight",
                function (context, dom_element, isd_element, attr) {
                    if (attr === "normal") {

                        dom_element.style.lineHeight = "normal";

                    } else {

                        dom_element.style.lineHeight = 
                            attr.multiply(
                                attr.multiply(
                                    attr.toUsedLength(context.w, context.h), context.options.sizeAdjust),
                                context.options.lineHeightAdjust) + "px";
                    }
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling opacity",
                function (context, dom_element, isd_element, attr) {
                    /*
                     * Customisable using <pre>regionOpacityScale: {number}</pre>
                     * which acts as a multiplier.
                     */
                    var opacity = attr;

                    if (context.options.regionOpacityScale != undefined) {
                        opacity = opacity * context.options.regionOpacityScale;
                    }

                    dom_element.style.opacity = opacity;
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling origin",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.top = attr.h.toUsedLength(context.w, context.h) + "px";
                    dom_element.style.left = attr.w.toUsedLength(context.w, context.h) + "px";
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling overflow",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.overflow = attr;
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling padding",
                function (context, dom_element, isd_element, attr) {

                    /* attr: top,left,bottom,right*/

                    /* style: top right bottom left*/

                    var rslt = [];

                    rslt[0] = attr[0].toUsedLength(context.w, context.h) + "px";
                    rslt[1] = attr[3].toUsedLength(context.w, context.h) + "px";
                    rslt[2] = attr[2].toUsedLength(context.w, context.h) + "px";
                    rslt[3] = attr[1].toUsedLength(context.w, context.h) + "px";

                    dom_element.style.padding = rslt.join(" ");
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling position",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.top = attr.h.toUsedLength(context.w, context.h) + "px";
                    dom_element.style.left = attr.w.toUsedLength(context.w, context.h) + "px";
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling rubyAlign",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.rubyAlign = attr === "spaceAround" ? "space-around" : "center";
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling rubyPosition",
                function (context, dom_element, isd_element, attr) {

                    /* skip if "outside", which is handled by applyRubyPosition() */

                    if (attr === "before" || attr === "after") {

                        var pos;

                        if (RUBYPOSITION_ISWK) {

                            /* WebKit exception */
        
                            pos = attr;
        
                        } else if (context.bpd === "tb") {

                            pos = (attr === "before") ? "over" : "under";


                        } else {

                            if (context.bpd === "rl") {

                                pos = (attr === "before") ? "over" : "under";

                            } else {

                                pos = (attr === "before") ? "under" : "over";

                            }

                        }

                        /* apply position to the parent dom_element, i.e. ruby or rtc */

                        dom_element.parentElement.style[RUBYPOSITION_PROP] = pos;
                    }
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling showBackground",
                null
                ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling textAlign",
                function (context, dom_element, isd_element, attr) {

                    var ta;

                    /* handle UAs that do not understand start or end */

                    if (attr === "start") {

                        ta = (context.ipd === "rl") ? "right" : "left";

                    } else if (attr === "end") {

                        ta = (context.ipd === "rl") ? "left" : "right";

                    } else {

                        ta = attr;

                    }

                    dom_element.style.textAlign = ta;

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling textDecoration",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.textDecoration = attr.join(" ").replace("lineThrough", "line-through");
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling textOutline",
                function (context, dom_element, isd_element, attr) {

                    /* defer to tts:textShadow */
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling textShadow",
                function (context, dom_element, isd_element, attr) {

                    var txto = isd_element.styleAttrs[imscStyles.byName.textOutline.qname];
                    var otxto = context.options.textOutline;
                    if (otxto) {
                        if (otxto === "none") {

                            txto = otxto;

                        } else {
                            var r = {};
                            var os = otxto.split(" ");
                            if (os.length !== 0 && os.length <= 2)
                            {
                                var c = imscUtils.parseColor(os[0]);

                                r.color = c;

                                if (c !== null)
                                    os.shift();

                                if (os.length === 1)
                                {
                                    var l = imscUtils.parseLength(os[0]);

                                    if (l)
                                    {
                                        r.thickness = l;

                                        txto = r;
                                    }
                                }
                            }
                        }
                    }

                    if (attr === "none" && txto === "none") {

                        dom_element.style.textShadow = "";

                    } else {

                        var s = [];

                        if (txto !== "none") {

                            /* emulate text outline */

                            var to_color = "rgba(" +
                                                txto.color[0].toString() + "," +
                                                txto.color[1].toString() + "," +
                                                txto.color[2].toString() + "," +
                                                (txto.color[3] / 255).toString() +
                                                ")";

                            s.push(  "1px 1px 1px " + to_color);
                            s.push(  "-1px 1px 1px " + to_color);
                            s.push(  "1px -1px 1px " + to_color);
                            s.push(  "-1px -1px 1px " + to_color);

                        }

                        /* add text shadow */

                        if (attr !== "none") {

                            for (var i in attr) {


                                s.push(attr[i].x_off.toUsedLength(context.w, context.h) + "px " +
                                        attr[i].y_off.toUsedLength(context.w, context.h) + "px " +
                                        attr[i].b_radius.toUsedLength(context.w, context.h) + "px " +
                                        "rgba(" +
                                        attr[i].color[0].toString() + "," +
                                        attr[i].color[1].toString() + "," +
                                        attr[i].color[2].toString() + "," +
                                        (attr[i].color[3] / 255).toString() +
                                        ")"
                                        );

                            }

                        }

                        dom_element.style.textShadow = s.join(",");

                    }
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling textCombine",
                function (context, dom_element, isd_element, attr) {

                    dom_element.style.textCombineUpright = attr.join(" ");

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling textEmphasis",
                function (context, dom_element, isd_element, attr) {

                    /* applied as part of HTML document construction */

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling unicodeBidi",
                function (context, dom_element, isd_element, attr) {

                    var ub;

                    if (attr === 'bidiOverride') {
                        ub = "bidi-override";
                    } else {
                        ub = attr;
                    }

                    dom_element.style.unicodeBidi = ub;
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling visibility",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.visibility = attr;
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling wrapOption",
                function (context, dom_element, isd_element, attr) {

                    if (attr === "wrap") {

                        if (isd_element.space === "preserve") {
                            dom_element.style.whiteSpace = "pre-wrap";
                        } else {
                            dom_element.style.whiteSpace = "normal";
                        }

                    } else {

                        if (isd_element.space === "preserve") {

                            dom_element.style.whiteSpace = "pre";

                        } else {
                            dom_element.style.whiteSpace = "noWrap";
                        }

                    }

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling writingMode",
                function (context, dom_element, isd_element, attr) {

                    var wm;

                    if (attr === "lrtb" || attr === "lr") {

                        dom_element.style.writingMode = "horizontal-tb";

                    } else if (attr === "rltb" || attr === "rl") {

                        dom_element.style.writingMode = "horizontal-tb";

                    } else if (attr === "tblr") {

                        dom_element.style.writingMode = "vertical-lr";

                    } else if (attr === "tbrl" || attr === "tb") {

                        dom_element.style.writingMode = "vertical-rl";

                    }

                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml#styling zIndex",
                function (context, dom_element, isd_element, attr) {
                    dom_element.style.zIndex = attr;
                }
        ),
        new HTMLStylingMapDefintion(
                "http://www.w3.org/ns/ttml/profile/imsc1#styling forcedDisplay",
                function (context, dom_element, isd_element, attr) {

                    if (context.displayForcedOnlyMode && attr === false) {
                        dom_element.style.visibility = "hidden";
                    }

                }
        )
    ];

    var STYLMAP_BY_QNAME = {};

    for (var i in STYLING_MAP_DEFS) {

        STYLMAP_BY_QNAME[STYLING_MAP_DEFS[i].qname] = STYLING_MAP_DEFS[i];
    }

    /* CSS property names */

    var RUBYPOSITION_ISWK = "webkitRubyPosition" in window.getComputedStyle(document.documentElement);

    var RUBYPOSITION_PROP = RUBYPOSITION_ISWK ? "webkitRubyPosition" : "rubyPosition";

    var TEXTEMPHASISSTYLE_PROP = "webkitTextEmphasisStyle" in window.getComputedStyle(document.documentElement) ? "webkitTextEmphasisStyle" : "textEmphasisStyle";

    var TEXTEMPHASISPOSITION_PROP = "webkitTextEmphasisPosition" in window.getComputedStyle(document.documentElement) ? "webkitTextEmphasisPosition" : "textEmphasisPosition";

    /* error utilities */

    function reportError(errorHandler, msg) {

        if (errorHandler && errorHandler.error && errorHandler.error(msg))
            throw msg;

    }

})(typeof exports === 'undefined' ? this.imscHTML = {} : exports,
        typeof imscNames === 'undefined' ? require("./names") : imscNames,
        typeof imscStyles === 'undefined' ? require("./styles") : imscStyles,
        typeof imscUtils === 'undefined' ? require("./utils") : imscUtils);
