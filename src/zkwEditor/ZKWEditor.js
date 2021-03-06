"use strict";

var RE = {};

window.onload = function () {
  RE.callback("ready");

  document.execCommand('insertBrOnReturn', false, true);
  document.execCommand('defaultParagraphSeparator', false, this.defaultParagraphSeparator);
  document.execCommand('styleWithCSS', false, false);
};

RE.editor = document.getElementById('field_content');
RE.quote = document.getElementById('field_quote_content');
RE.replyChangeToEditTopic = document.getElementById('replyChangeToEditTopic');
RE.closeReplyChangeEditTip = document.getElementById('closeReplyChangeEditTip');

RE.blurTipsOn = document.getElementById('blur_switch').innerHTML == 'yes'

/** @type {Number} 内容最小字数 */
RE.CONTENT_MIN_LENGTH = 4;

/*
    事件派发
 */
RE.callbackQueue = [];
RE.runCallbackQueue = function () {
  if (RE.callbackQueue.length === 0) {
    return;
  }
  setTimeout(function () {
    window.location.href = "re-callback://";
  }, 0);
};

RE.callback = function (method) {
  RE.callbackQueue.push(method);
  RE.runCallbackQueue();
};

RE.getCommandQueue = function () {
  var commands = JSON.stringify(RE.callbackQueue);
  RE.callbackQueue = [];
  return commands;
};

RE.customAction = function (action) {
  RE.callback("action/" + action);
};


/*
    监听事件
 */
document.addEventListener("selectionchange", function () {
  RE.backuprange();
});

//正文
RE.editor.addEventListener("input", function (e) {
  RE.updateContentPlaceholder();
  RE.backuprange();
  RE.callback("inputContent");
  RE.removeLengthInfo(e, RE.CONTENT_MIN_LENGTH);
});

RE.editor.addEventListener("focus", function () {
  RE.backuprange();
});

RE.editor.addEventListener("blur", function (e) {
  RE.checkLength(e, RE.CONTENT_MIN_LENGTH);
  RE.callback("blurFocusContent");
});

RE.editor.addEventListener("touchend", function (e) {
  RE.handleTapEvent(e);
});

//提示
RE.replyChangeToEditTopic.addEventListener("touchend", function (e) {
  RE.callback("replyChangeToEditTopic");
});

RE.closeReplyChangeEditTip.addEventListener("touchend", function (e) {
  RE.closeReplyChangeEditTip(e);
});


/*
    内容变化时计算滚动位置
 */
RE.getRelativeCaretYPosition = function () {
  var y = 0;
  var height = 20;
  var focus = false
  if (window.getSelection().rangeCount <= 0) {//没有focus时，getSelection无效
    RE.focusContent();
    focus = true;
  }

  var sel = window.getSelection();
  if (sel.rangeCount) {
    var range = sel.getRangeAt(0);
    var insetSpan = false;
    var span = document.createElement('span');
    var needsWorkAround = (range.startOffset == 0);
    /* Removing fixes bug when node name other than 'div' */
    // && range.startContainer.nodeName.toLowerCase() == 'div');

    if (needsWorkAround) {//换行时，range为 nil，这里在新行头加上临时span的方式计算光标位置
      //直接使用下面这句时，只能计算编辑器头部没有编辑转化、引用等情况
      //y = range.startContainer.offsetTop - window.pageYOffset;

      range.collapse(false);
      range.insertNode(span);
      insetSpan = true;

      //在p标签后输入换行，默认插入是<p><br/></p>, 换行输入时，编辑器不知道为何光标总是在下方，上层计算后会上移，但是看起来会有一次跳动，这里处理下
      if (range.startContainer.nodeName.toLowerCase() == 'p') {
        var preNode = span.parentNode.previousSibling;
        var parentNode = preNode.parentNode;
        parentNode.removeChild(span.parentNode);
        //alert("needsWorkAround p");
        var newNode = document.createElement('br');
        parentNode.appendChild(newNode);
        parentNode.appendChild(span);
        RE.backSpaceLocate(span);
        RE.focusContent();
      }
    }

    if (range.getClientRects) {
      var rects = range.getClientRects();
      if (rects.length > 0) {
        y = rects[0].top;
        height = rects[0].height;
        if (height <= 0) {   //兼容
          height = 20;
        }
        //alert("y" + y + "h" + height);
      }
    }

    if (y <= 0) {
      range.collapse(false);
      range.insertNode(span);
      insetSpan = true;

      var temp = span.parentNode.getBoundingClientRect();
      y = temp.top;
      height = temp.height;
      //alert("lal: y=" + temp.top + ",h=" + temp.height);
    }

    if (insetSpan) {
      span.parentNode.removeChild(span);
    }
  }

  if (focus) {
    RE.blurFocus();
  }

  return y + "+" + height;
};

/*
    光标处理等基础函数
 */
RE.updateHeight = function () {
  RE.callback("updateHeight");
}

RE.checkContentEmpty = function () {
  var html = RE.editor.innerHTML;
  var ret = false;
  if (html.length == 0 || html == "<br>") {
    ret = true;
  }
  return ret;
};

RE.insertHTML = function (html) {
  RE.restorerange();
  document.execCommand('insertHTML', false, html);
};

RE.prepareInsert = function () {
  RE.backuprange();
};

RE.backuprange = function () {
  var selection = window.getSelection();
  if (selection.rangeCount > 0) {
    var range = selection.getRangeAt(0);
    RE.currentSelection = {
      "startContainer": range.startContainer,
      "startOffset": range.startOffset,
      "endContainer": range.endContainer,
      "endOffset": range.endOffset
    };
  }
};

RE.restorerange = function () {
  var selection = window.getSelection();
  selection.removeAllRanges();
  var range = document.createRange();
  range.setStart(RE.currentSelection.startContainer, RE.currentSelection.startOffset);
  range.setEnd(RE.currentSelection.endContainer, RE.currentSelection.endOffset);
  selection.addRange(range);
};

RE.focusToEnd = function () {
  var range = document.createRange();
  range.selectNodeContents(RE.editor);
  range.collapse(false);
  var selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  RE.editor.focus();
};

RE.checkLength = function (e, minLength) {

  if (RE.blurTipsOn == false) {
    return;
  }
  var ele = e.target;
  var currentLength = ele.innerHTML.length;

  if (currentLength < minLength) {
    ele.classList.add('info-length');
    ele.setAttribute('data-infotext', '不能少于' + minLength + '个字');
  } else {
    ele.classList.remove('info-length');
    ele.removeAttribute('data-infotext');
  }
}

RE.removeLengthInfo = function (e, minLength) {
  var ele = e.target;
  var currentLength = ele.innerHTML.length;

  if (currentLength >= minLength) {
    ele.classList.remove('info-length');
    ele.removeAttribute('data-infotext');
  }
}

/*
    事件响应函数
 */
RE.closeReplyChangeEditTip = function (e) {
  document.getElementById('replyOwnTopic').remove();
};

RE.handleTapEvent = function (e) {
  //RE.editor != document.activeElement
  RE.callback("contentAreaTapped");

  if (e.target.nodeName.toLowerCase() == 'img') {
    e.preventDefault(); //否则会定位

    var selection = window.getSelection();
    selection.removeAllRanges();
    var range = document.createRange();
    range.setStartAfter(e.target);
    range.collapse(true);
    selection.addRange(range);
    RE.backuprange();
  }
};

/*
    外部调用函数
 */

//placeHolder 处理

RE.setContentPlaceholder = function (body) {
  RE.editor.setAttribute("placeholder", body);
  RE.updateContentPlaceholder();
};

RE.updateContentPlaceholder = function () {
  // var nbsp = '\xa0';
  // var text = RE.editor.innerText.replace(nbsp, '');

  //输入后再删除最后还是会留个<br>
  if (RE.checkContentEmpty() == true) {
    RE.editor.classList.add("placeholder");
  } else {
    RE.editor.classList.remove("placeholder");
  }
};

RE.getContent = function () {
  var body = RE.editor.innerHTML;

  //去掉最开头的<br> ,body.startsWith("<br>") iOS8下解析不过
  if (body.substring(0, 4) == "<br>") {
    body = body.substring(4, body.length);
  }
  return body;
};

RE.getContentLength = function () {
  var body = RE.editor.innerHTML;
  body = body.replace('&nbsp;', ' ');
  body = body.replace('&nbsp', ' ');
  return body.length;
};

RE.insertImage = function (url, classStr, alt) {
  var img = document.createElement('img');
  img.setAttribute("src", url);
  img.setAttribute("class", classStr)
  img.setAttribute("alt", alt);
  img.onload = RE.updateHeight;

  RE.insertHTML(img.outerHTML);
};

RE.insertLocalImage = function (localUrl, remoteUrl, classStr, alt) {
  var img = document.createElement('img');
  img.setAttribute("src", localUrl);
  img.setAttribute("remoteSrc", remoteUrl);
  img.setAttribute("alt", alt);
  img.onload = RE.updateHeight;

  RE.insertHTML(img.outerHTML);
};

RE.handleContentAreaTapped = function (position) {//外部调用，点击在内容外，不会触发聚焦行为，为防止覆盖默认的点击定位光标行为，导致光标位置不准需要判断
  if (RE.editor == document.activeElement) {
    return
  }

  if (RE.checkContentEmpty() == true) {
    RE.focusToEnd();
  } else if (RE.editor.offsetHeight + 15 < position) { //pading算在内，但不包括margin
    RE.focusToEnd();
  }
  RE.callback("contentAreaTapped");
};

//删除操作
RE.backspace = function () {
  var range = document.createRange();
  range.setStart(RE.currentSelection.startContainer, RE.currentSelection.startOffset);
  range.setEnd(RE.currentSelection.endContainer, RE.currentSelection.endOffset);
  range.collapse(false);

  //alert("before add span stag " + range.startContainer.tagName + " so "+ range.startOffset + " etag " + range.endContainer.tagName+" eo "+range.endOffset + " c "+range.collapsed );

  var span = document.createElement('span');
  range.insertNode(span);
  var preNode = span.previousSibling;
  var parentNode = span.parentNode;

  //alert("after add span preNode name" + preNode.nodeName.toLowerCase() + " stag " + range.startContainer.tagName + " so "+ range.startOffset + " etag " + range.endContainer.tagName+" eo "+range.endOffset + " c "+range.collapsed );

  if (preNode.nodeName.toLowerCase() == 'img') {

    parentNode.removeChild(span);
    var preNodePre = preNode.previousSibling;
    if (preNodePre == null) {
      if (parentNode.parentNode.tagName.toLowerCase() == "body") {
        parentNode.removeChild(preNode);
        RE.backSpaceReset();
      } else {
        parentNode.removeChild(preNode);
        preNodePre = parentNode.parentNode.lastChild;
        RE.backSpaceLocate(preNodePre);
      }
    } else {
      parentNode.removeChild(preNode);
      RE.backSpaceLocate(preNodePre);
    }

  } else if (preNode.nodeName.toLowerCase() == '#text') {

    parentNode.removeChild(span);
    var text = preNode.textContent;
    //alert("text"+text);
    preNode.textContent = text.slice(0, -1);

    if (preNode.textContent.length <= 0) {
      var preNodePre = preNode.previousSibling;
      if (preNodePre == null) {
        if (parentNode.parentNode.tagName.toLowerCase() == "body") {
          parentNode.removeChild(preNode);
          RE.backSpaceReset();
        } else {
          parentNode.removeChild(preNode);
          preNodePre = parentNode.parentNode.lastChild;
          RE.backSpaceLocate(preNodePre);
        }
      } else {
        parentNode.removeChild(preNode);
        RE.backSpaceLocate(preNodePre);
      }

    } else {
      RE.backSpaceLocate(preNode);
    }
  }
};

RE.backSpaceReset = function () {
  var rangeBak = document.createRange();
  rangeBak.selectNodeContents(RE.editor);
  rangeBak.collapse(false);
  RE.currentSelection = {
    "startContainer": rangeBak.startContainer,
    "startOffset": rangeBak.startOffset,
    "endContainer": rangeBak.endContainer,
    "endOffset": rangeBak.endOffset
  };
};

RE.backSpaceLocate = function (destNode) {
  var rangeBak = document.createRange();
  rangeBak.setStartAfter(destNode);
  rangeBak.collapse(true);

  //alert("restore after backspace" + " stag " + rangeBak.startContainer.tagName + " so "+ rangeBak.startOffset + " etag " + rangeBak.endContainer.tagName+" eo "+rangeBak.endOffset + " c "+ rangeBak.collapsed );

  RE.currentSelection = {
    "startContainer": rangeBak.startContainer,
    "startOffset": rangeBak.startOffset,
    "endContainer": rangeBak.endContainer,
    "endOffset": rangeBak.endOffset
  };
};


RE.setBlockquote = function () {
  document.execCommand('formatBlock', false, '<blockquote>');
};

RE.insertLink = function (url, title) {
  RE.restorerange();
  var sel = document.getSelection();
  if (sel.toString().length != 0) {
    if (sel.rangeCount) {

      var el = document.createElement("a");
      el.setAttribute("href", url);
      el.setAttribute("title", title);

      var range = sel.getRangeAt(0).cloneRange();
      range.surroundContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
};

RE.setContentHtml = function (contents) {
  var tempWrapper = document.createElement('div');
  tempWrapper.innerHTML = contents;
  var images = tempWrapper.querySelectorAll("img");

  for (var i = 0; i < images.length; i++) {
    images[i].onload = RE.updateHeight;
  }

  RE.editor.innerHTML = tempWrapper.innerHTML;
  RE.updateContentPlaceholder();
};

RE.getText = function () {
  return RE.editor.innerText;
};

RE.removeFormat = function () {
  document.execCommand('removeFormat', false, null);
};

RE.setFontSize = function (size) {
  RE.editor.style.fontSize = size;
};

RE.setBackgroundColor = function (color) {
  RE.editor.style.backgroundColor = color;
};

RE.setHeight = function (size) {
  RE.editor.style.height = size;
};

RE.undo = function () {
  document.execCommand('undo', false, null);
};

RE.redo = function () {
  document.execCommand('redo', false, null);
};

RE.setBold = function () {
  document.execCommand('bold', false, null);
};

RE.setNormal = function () {
  RE.editor.style.fontWeight = false;
};

RE.setItalic = function () {
  document.execCommand('italic', false, null);
};

RE.setSubscript = function () {
  document.execCommand('subscript', false, null);
};

RE.setSuperscript = function () {
  document.execCommand('superscript', false, null);
};

RE.setStrikeThrough = function () {
  document.execCommand('strikeThrough', false, null);
};

RE.setUnderline = function () {
  document.execCommand('underline', false, null);
};

RE.setTextColor = function (color) {
  RE.restorerange();
  document.execCommand("styleWithCSS", null, true);
  document.execCommand('foreColor', false, color);
  document.execCommand("styleWithCSS", null, false);
};

RE.setTextBackgroundColor = function (color) {
  RE.restorerange();
  document.execCommand("styleWithCSS", null, true);
  document.execCommand('hiliteColor', false, color);
  document.execCommand("styleWithCSS", null, false);
};

RE.setHeading = function (heading) {
  document.execCommand('formatBlock', false, '<h' + heading + '>');
};

RE.setIndent = function () {
  document.execCommand('indent', false, null);
};

RE.setOutdent = function () {
  document.execCommand('outdent', false, null);
};

RE.setOrderedList = function () {
  document.execCommand('insertOrderedList', false, null);
};

RE.setUnorderedList = function () {
  document.execCommand('insertUnorderedList', false, null);
};

RE.setJustifyLeft = function () {
  document.execCommand('justifyLeft', false, null);
};

RE.setJustifyCenter = function () {
  document.execCommand('justifyCenter', false, null);
};

RE.setJustifyRight = function () {
  document.execCommand('justifyRight', false, null);
};
