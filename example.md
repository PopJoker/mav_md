# Markdown 語法完整範例

這是一份根據 [markdown.tw](https://markdown.tw/) 整理的 Markdown 語法範例文件，涵蓋所有常用格式。

---

## 目錄

1. [標題](#標題)
2. [段落與換行](#段落與換行)
3. [強調](#強調)
4. [清單](#清單)
5. [區塊引言](#區塊引言)
6. [程式碼](#程式碼)
7. [分隔線](#分隔線)
8. [連結](#連結)
9. [圖片](#圖片)
10. [表格](#表格)
11. [自動連結](#自動連結)
12. [跳脫字元](#跳脫字元)

---

## 標題

Markdown 支援兩種標題語法。

### Setext 形式（底線）

使用 `=` 與 `-` 底線：

```markdown
This is an H1
=============

This is an H2
-------------
```

### Atx 形式（井字號）

在行首插入 1 到 6 個 `#`：

```markdown
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

#### H4 範例
##### H5 範例
###### H6 範例

---

## 段落與換行

一個段落是由一個以上相連接的行句組成。段落之間用空行分隔。

這是第一個段落。Markdown 會將相連的行合併為同一個段落。

這是第二個段落。如果你真的想要插入 `<br />` 標籤，可以在行尾加上兩個以上的空白，或是直接使用 HTML 的 `<br />` 標籤。

這是第一行<br />
這是第二行（使用 HTML 標籤換行）

---

## 強調

Markdown 使用星號 `*` 或底線 `_` 來標記強調。

```markdown
*single asterisks*
_single underscores_
**double asterisks**
__double underscores__
```

*單星號強調*
_單底線強調_
**雙星號強調**
__雙底線強調__

強調也可以直接插在文字中間：

```markdown
un*frigging*believable
```

un*frigging*believable

---

## 清單

### 無序清單

```markdown
*   Red
*   Green
*   Blue
```

*   Red
*   Green
*   Blue

### 有序清單

```markdown
1.  Bird
2.  McHale
3.  Parish
```

1.  Bird
2.  McHale
3.  Parish

### 巢狀清單

```markdown
*   水果
    *   蘋果
    *   香蕉
*   蔬菜
    1.  紅蘿蔔
    2.  高麗菜
```

*   水果
    *   蘋果
    *   香蕉
*   蔬菜
    1.  紅蘿蔔
    2.  高麗菜

---

## 區塊引言

使用 `>` 來建立區塊引言：

```markdown
> This is a blockquote with two paragraphs.
>
> Donec sit amet nisl. Aliquam semper ipsum sit amet velit.
```

> This is a blockquote with two paragraphs.
>
> Donec sit amet nisl. Aliquam semper ipsum sit amet velit.

### 巢狀引言

```markdown
> This is the first level of quoting.
>
> > This is nested blockquote.
>
> Back to the first level.
```

> This is the first level of quoting.
>
> > This is nested blockquote.
>
> Back to the first level.

---

## 程式碼

### 行內程式碼

使用反引號包圍：

```markdown
Use the `printf()` function.
```

Use the `printf()` function.

### 圍籬程式碼區塊（支援語法高亮）

使用三個反引號並標註語言：

```javascript
function greet(name) {
    console.log(`Hello, \${name}!`);
    return true;
}
```

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
```

```css
.markdown-body h1 {
    font-size: 2rem;
    border-bottom: 1px solid #e7e9f0;
}
```

```html
<div class="container">
    <p>Hello, World!</p>
</div>
```

---

## 分隔線

使用三個或以上的星號、減號或底線：

```markdown
***
---
___
```

---

## 連結

### 行內形式

```markdown
This is [an example](http://example.com/ "Title") inline link.
```

This is [an example](http://example.com/ "Title") inline link.

### 參考形式

```markdown
This is [an example][id] reference-style link.

[id]: http://example.com/  "Optional Title Here"
```

This is [an example][id] reference-style link.

[id]: http://example.com/  "Optional Title Here"

---

## 圖片

```markdown
![Alt text](/path/to/img.jpg "Optional title")
```

實際範例：

![Markdown Logo](https://markdown.tw/images/208x128.png "Markdown 標誌")

---

## 表格

```markdown
| 語法 | 說明 | 範例 |
|------|------|------|
| `**文字**` | 粗體 | **粗體** |
| `*文字*` | 斜體 | *斜體* |
```

| 語法 | 說明 | 範例 |
|------|------|------|
| `**文字**` | 粗體 | **粗體** |
| `*文字*` | 斜體 | *斜體* |

### 對齊方式

```markdown
| 靠左 | 置中 | 靠右 |
|:-----|:----:|-----:|
| A    | B    | C    |
```

| 靠左 | 置中 | 靠右 |
|:-----|:----:|-----:|
| A    | B    | C    |

---

## 自動連結

```markdown
<http://example.com/>
<address@example.com>
```

<http://example.com/>

<address@example.com>

---

## 跳脫字元

使用反斜線來插入特殊符號：

```markdown
\\*literal asterisks\\*
```

\\*literal asterisks\\*

---

## 特殊字元自動轉換

Markdown 會自動將 `<` 和 `&` 轉換為 HTML 實體：

```markdown
4 < 5
AT&T
```

4 < 5

AT&T

---

## 參考資料

- [Markdown 語法說明（正體中文）](https://markdown.tw/)

---

*文件結束*